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

    // TODO: For now we'll just enforce that the new platorm needs to be in the same deployment as the host platform. But in the future we might want to allow it to be hosted on a platform in a public network, or in a deployment that the user also has sufficient rights to.
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
        logger.debug(`Host platform '${hostPlatform.id}' does not have a current location, thus the new platform '${platform.name}' won't inherit its location`);
      } else {
        throw err;
      }      
    }
  }

  let newPlatformLocation;
  if (locationToAdd) {
    newPlatformLocation = await platformLocationService.createPlatformLocation({
      platform: createdPlatform.id,
      startDate: new Date(),
      location: locationToAdd
    });
    createdPlatform.location = newPlatformLocation.location;
    // TODO: Should we delete the platform document if we failed to create a platform location?
  }

  return platformService.platformAppToClient(createdPlatform);

}



export async function getPlatform(id: string, options?: {includeCurrentLocation: boolean}): Promise<PlatformClient> {
  
  const platform: PlatformApp = await platformService.getPlatform(id);

  if (options && options.includeCurrentLocation) {
    const platformLocation: PlatformLocationApp = await platformLocationService.getCurrentPlatformLocation(id);
    platform.location = platformLocation.location;
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
  isHostedBy: joi.string(),
  static: joi.boolean()
});
// N.B. We don't allow the client to edit the hostedByPath, this is automatically updated in response to a change of isHostedBy.
// Adding and removing platforms from deployments is handled by other controllers.
export async function updatePlatform(id: string, updates: any): Promise<PlatformClient> {

  const {error: validationErr} = platformUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Get the current platform document
  const oldPlatform = await platformService.getPlatform(id);

  const isHostedByChange = check.containsKey(updates, 'isHostedBy') && 
    oldPlatform.isHostedBy !== updates.isHostedBy &&
    !(!oldPlatform.isHostedBy && updates.isHostedBy === null);

  let hostPlatform: PlatformApp;

  if (updates.isHostedBy) {
    // Does the host platform exist (errors if not)?
    hostPlatform = platformService.getPlatform(updates.isHostedBy);
    // This host platform must either be owned by a public deployment or have the same ownerDeployment as this platform.
    // TODO: Should we allow a user to host a platfrom on a platform in a private deployment that the particular user also has rights too? This would involve passing in the user id as an option to this controller, or having the client microservice check the user's rights itself first.
    if (hostPlatform.ownerDeployment !== oldPlatform.ownerDeployment) {
      logger.debug('The new host platform has a different owner deployment to the hostee platform, thus a check will be performed to see if the host platform is owned by a public deployment.');
    }
    const hostPlatformOwnerDeployment = await deploymentService.getDeployment(hostPlatform.ownerDeployment);
    if (hostPlatformOwnerDeployment.public === false) {
      throw new HostPlatformInPrivateDeployment(`The host platform '${updates.isHostedBy}' is in a private deployment, therefore you do not have the rights to host platform '${id}' on it.`);
    }
  }

  // Am I best having all this rehosting logic in a separate controller(s), and perhaps only using this controller for basic updates?
  // TODO: I'd say lets allow isHostedBy as a property of this function's updates argument, but lets have a controller called unhostPlatform and another called rehostPlatform that are called from here. They will each call the corresponding service function, but they will also handle sorting out all the context too. 
  if (isHostedByChange) {
    if (updates.isHostedBy === null) {
      await platformService.unhostPlatform(id);
    } else {
      await platformService.rehostPlatform(id, updates.isHostedBy); 
    }
  }

  // TODO TODO TODO

  // TODO: There's a hell of a lot to consider in here. In particular:
  // - Make sure all the hostedByPath platforms update if the isHostedBy field is included as an update. Do this for any descendents too. 
  // - Update the context of any sensors on these platforms.
  // - You've also got to check that this platform is in the same deployment. Or might we allow it to hosted on a public deployment?

}


// E.g. for sharing a platform with a deployment other than the one that created it.
export async function addPlatformToDeployment(platformId, deploymentId): Promise<PlatformClient> {

}


export async function removePlatformFromDeployment(platformId, deploymentId): Promise<PlatformClient> {
  
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