import {PlatformClient} from './platform-client.class';
import * as deploymentService from '../deployment/deployment.service';
import * as platformService from '../platform/platform.service';
import * as platformLocationService from '../platform-location/platform-location.service';
import {InvalidPlatform} from './errors/InvalidPlatform';
import * as check from 'check-types';
import {PlatformApp} from './platform-app.class';
import {PlatformNotFound} from './errors/PlatformNotFound';
import * as logger from 'node-logger';
import {nameToClientId} from '../../utils/name-to-client-id';
import {cloneDeep, concat} from 'lodash';
import {generateClientIdSuffix} from '../../utils/generate-client-id-suffix';
import {PlatformLocationApp} from '../platform-location/platform-location-app.class';
import * as sensorService from '../sensor/sensor.service';
import * as Promise from 'bluebird';
import {SensorApp} from '../sensor/sensor-app.class';
import * as contextService from '../context/context.service';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {HostPlatformInPrivateDeployment} from './errors/HostPlatformInPrivateDeployment';



export async function createPlatform(platform: PlatformClient): Promise<PlatformClient> {

  const hostPlatformSpecified = check.assigned(platform.isHostedBy);
  const locationSpecified = check.assigned(platform.location);
  const idSpecified = check.assigned(platform.id);

  // TODO: Should we enforce a rule that if the platform is static then a location must be provided?

  // Check the deployment exists
  if (check.nonEmptyString(platform.ownerDeployment)) {
    // These get functions will throw an error if the resource doesn't exists, which is what we want.
    await deploymentService.getDeployment(platform.ownerDeployment);
  } else {
    throw new InvalidPlatform(`The platform property 'ownerDeployment' must be a non-empty string`);
  }

  // Check the host platform exists
  let hostPlatform: PlatformApp;
  if (hostPlatformSpecified) {
    try {
      hostPlatform = await platformService.getPlatform(platform.isHostedBy);
    } catch (err) {
      if (err.name === 'PlatformNotFound') {
        throw new PlatformNotFound(`Could not find the platform '${platform.isHostedBy}' provided as the 'isHostedBy' property.`);
      } else {
        throw err;
      }
    }

    // TODO: For now we'll just enforce that the new platform needs to be in the same deployment as the host platform. But in the future we might want to allow it to be hosted on a platform in a public network, or in a deployment that the user also has sufficient rights to.
    if (!(hostPlatform.inDeployments.includes(platform.ownerDeployment))) {
      throw new InvalidPlatform(`The platform you wish to create has the deployment ${platform.ownerDeployment}, however the platform you wish to host it on is not associated with this deployment.`);
    }
  
    // Enforce the rule that a static platform can't be hosted a mobile platform
    if (hostPlatform.static === false && platform.static === true) {
      throw new InvalidPlatform('A static platform cannot be hosted by a mobile platform.');
    }

    logger.debug('Host Platform', hostPlatform);
  }

  const platformToCreate = cloneDeep(platform);
  delete platformToCreate.location;
  platformToCreate.inDeployments = [platformToCreate.ownerDeployment];
  if (!idSpecified) {
    platformToCreate.id = nameToClientId(platformToCreate.name);
    logger.debug(`The platform name: '${platform.name}' has been converted to an id of '${platformToCreate.id}'`);
  }

  // Add a hostedByPath if required
  if (hostPlatform) {
    if (hostPlatform.hostedByPath) {
      platformToCreate.hostedByPath = concat(hostPlatform.hostedByPath, hostPlatform.id);
    } else {
      platformToCreate.hostedByPath = [hostPlatform.id];
    }
  }

  let createdPlatform: PlatformApp;
  try {
    createdPlatform = await platformService.createPlatform(platformToCreate);
  } catch (err) {
    // If we generated an id from the name and this id is already taken then add a suffix and try again.
    if (!idSpecified && err.name === 'PlatformAlreadyExists') {
      platformToCreate.id = `${platformToCreate.id}-${generateClientIdSuffix()}`;
      createdPlatform = await platformService.createPlatform(platformToCreate);
    } else {
      throw err;
    }
  }

  logger.debug('New platform created', createdPlatform);

  // Add a new platform location
  let locationToAdd;

  if (locationSpecified) {
    locationToAdd = platform.location;
  } else if (hostPlatformSpecified) {
    // Get the current location of the host platform
    try {
      const hostPlatformLocation = await platformLocationService.getCurrentPlatformLocation(hostPlatform.id);
      locationToAdd = hostPlatformLocation.location;
    } catch (err) {
      if (err.name === 'PlatformLocationNotFound') {
        logger.debug(`Host platform '${hostPlatform.id}' does not have a current location, thus the new platform '${platform.name}' won't inherit its location.`);
      } else {
        throw err;
      }      
    }
  }

  let newPlatformLocation;
  if (locationToAdd) {
    const dateNow = new Date();
    newPlatformLocation = await platformLocationService.createPlatformLocation({
      platform: createdPlatform.id,
      date: dateNow,
      location: locationToAdd,
      // Let's use the platform id in the location id to help keep this id unique.
      locationId: `${createdPlatform.id}-${dateNow.toISOString()}` 
    });
    logger.debug(`Platform location created`, newPlatformLocation);
    // TODO: Should we delete the platform document if we failed to create a platform location?
  }

  const platformForClient = platformService.platformAppToClient(createdPlatform);
  if (newPlatformLocation) {
    platformForClient.location = platformLocationService.platformLocationAppToClient(newPlatformLocation);
  }
  return platformForClient;

}



export async function getPlatform(id: string, options?: {includeCurrentLocation: boolean}): Promise<PlatformClient> {
  
  const platform: PlatformApp = await platformService.getPlatform(id);

  let platformLocation;
  if (options && options.includeCurrentLocation) {
    try {
      platformLocation = await platformLocationService.getCurrentPlatformLocation(id);
      platform.location = platformLocation.location;
    } catch (err) {
      if (err.name === 'PlatformLocationNotFound') {
        logger.debug(`Unable to find a location for the platform ${id}. It may simply not have been assigned one yet.`);
      } else {
        throw err;
      }
    }
  }

  const platformForClient = platformService.platformAppToClient(platform);
  if (platformLocation) {
    platformForClient.location = platformLocationService.platformLocationAppToClient(platformLocation);
  }
  return platformService.platformAppToClient(platform);

}


export async function getPlatforms(where: {inDeployment?: string}, options?: {includeCurrentLocation: boolean}): Promise<PlatformClient[]> {

  let platforms: PlatformApp[] = await platformService.getPlatforms(where);
  logger.debug('Platforms found', platforms);

  logger.debug('options', options);

  if (options && options.includeCurrentLocation) {
    // Get the current location of each of these platforms
    const platformIds = platforms.map((platform): string => platform.id);
    const currentLocations = await platformLocationService.getCurrentPlatformLocations(platformIds);
    logger.debug('Found current platform locations', currentLocations);
    platforms = platformService.mergePlatformsWithPlatformLocations(platforms, currentLocations);
  }

  return platforms.map(platformService.platformAppToClient);

}


const platformUpdatesSchema = joi.object({
  name: joi.string(),
  description: joi.string(),
  static: joi.boolean().valid(false) // for now I'll only allow static to be changed to mobile.
});
// N.B. this particular function only allows certain properties of a platform to be updated, i.e. direct features of a platform rather than its relationships with other things, e.g. other platforms and deployments. Other controller functions handle this.
export async function updatePlatform(id: string, updates: any): Promise<PlatformClient> {

  const {error: validationErr} = platformUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // TODO: If the static property is being changed then we need a check to make sure we don't end up with a static platform being hosted on a mobile one.

  // Get the current platform document
  const updatedPlatform = await platformService.updatePlatform(id, updates);

  // TODO: Add the platform location?
  return platformService.platformAppToClient(updatedPlatform);

}


export async function unhostPlatform(id): Promise<PlatformApp> {

  const {platform: updatedPlatform, oldAncestors} = await platformService.unhostPlatform(id);
  await contextService.processPlatformHostChange(id, oldAncestors, []);
  return updatedPlatform;

}


export async function rehostPlatform(id, hostId): Promise<PlatformApp> {

  logger.debug(`About to rehost platform ${id} on ${hostId}`);

  const platform = await platformService.getPlatform(id);
  const hostPlatform = await platformService.getPlatform(hostId);

  // Enforce the rule that a static platform can't be hosted a mobile platform
  if (hostPlatform.static === false && platform.static === true) {
    throw new InvalidPlatform('A static platform cannot be hosted by a mobile platform.');
  }  

  const {platform: updatedPlatform, oldAncestors, newAncestors} = await platformService.rehostPlatform(id, hostId);
  logger.debug(`About to process the contexts following a platform host change.`, {id, oldAncestors, newAncestors});
  await contextService.processPlatformHostChange(id, oldAncestors, newAncestors);
  logger.debug('Rehosted platform', updatedPlatform);

  // Update the platform locations - this is actually quite simple, you simply take the last known location of the new host (if available), and apply this to the rehosted platform and any child platforms it may have.
  const currentHostPlatformLocation = await platformLocationService.getCurrentPlatformLocation(hostPlatform.id);
  if (currentHostPlatformLocation) {
    // Does this platform have any descendents
    const descendentPlatforms = await platformService.getdescendantsOfPlatform(id);
    const platformIds = concat(id, descendentPlatforms.map((descendentPlatform) => descendentPlatform.id));
    const newPlatformLocations = await Promise.map(platformIds, async (platformId): Promise<void> => {
      const newPlatformLocation = await platformLocationService.createPlatformLocation({
        // N.B. we assign a new date rather than inheriting it from the new host, the reason being that what we inherit could be very out of date, and the platform being rehosted may have a location dated after this.
        platform: platformId,
        date: new Date(),
        location: currentHostPlatformLocation.location,
        locationId: currentHostPlatformLocation.locationId
      });
      return newPlatformLocation;
    });
    logger.debug('New platform locations following rehost', newPlatformLocations);
  }

  logger.debug(`Platform ${id} has been successfully rehosted on ${hostId}, and the corresponding contexts and locations have been updated too.`);

  return updatedPlatform;

}


// They'll probably be a few steps carried out before this function is run, e.g. a user of the platform's original deployment will need to send an invite to users of the new deployment, which they will need to accept, at which point this can function can be run.
export async function sharePlatformWithDeployment(platformId, deploymentId): Promise<PlatformClient> {

  // Get the deployment to check it exists
  await deploymentService.getDeployment(deploymentId);

  const updatedPlatform = await platformService.sharePlatformWithDeployment(platformId, deploymentId);

  // Now to update the context of sensors on this platform
  await contextService.processPlatformSharedWithDeployment(platformId, deploymentId);

  return platformService.platformAppToClient(updatedPlatform);

}


export async function unsharePlatformWithDeployment(platformId, deploymentId): Promise<PlatformClient> {
  
  const updatedPlatform = await platformService.unsharePlatformWithDeployment(platformId, deploymentId);

  // Now to update the context of sensors on this platform
  await contextService.processPlatformUnsharedWithDeployment(platformId, deploymentId);

  return platformService.platformAppToClient(updatedPlatform);

}


export async function deletePlatform(id: string): Promise<void> {

  // Need some extra info about the platform before we can delete it.
  const platform = await platformService.getPlatform(id); 

  // Update any platforms that are hosted on this platform
  await platformService.cutDescendantsOfPlatform(id);
  // TODO: We need to update the context of sensors hosted on these descendant platforms.

  // Delete the platform
  await platformService.deletePlatform(id);
  
  // Get all the sensors hosted on this platform 
  const sensors: SensorApp[] = await sensorService.getSensors({isHostedBy: id});

  // Loop through each sensor
  await Promise.map(sensors, async (sensor) => {

    await sensorService.removeSensorFromPlatform(sensor.id);

    // If the sensor is physically attached to this platform then we need to remove it from the deployment to
    if (sensor.permanentHost) {
      await sensorService.removeSensorFromDeployment(sensor.id);
    }

    // Update the contexts
    if (sensor.permanentHost) {
      await contextService.processSensorRemovedFromDeployment(sensor.id, sensor.defaults);
    } else {
      await contextService.processSensorRemovedFromPlatform(sensor.id);
    }

  });

  // Add an endDate to its platform location?

  return;

}