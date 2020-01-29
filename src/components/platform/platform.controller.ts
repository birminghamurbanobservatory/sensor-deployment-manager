import {PlatformClient} from './platform-client.class';
import * as deploymentService from '../deployment/deployment.service';
import * as platformService from '../platform/platform.service';
import {InvalidPlatform} from './errors/InvalidPlatform';
import * as check from 'check-types';
import {PlatformApp} from './platform-app.class';
import {PlatformNotFound} from './errors/PlatformNotFound';
import * as logger from 'node-logger';
import {nameToClientId} from '../../utils/name-to-client-id';
import {cloneDeep, concat, difference} from 'lodash';
import {generateClientIdSuffix} from '../../utils/generate-client-id-suffix';
import * as sensorService from '../sensor/sensor.service';
import * as Promise from 'bluebird';
import {SensorApp} from '../sensor/sensor-app.class';
import * as contextService from '../context/context.service';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {Forbidden} from '../../errors/Forbidden';
import {validateGeometry} from '../../utils/geojson-validator';
import {v4 as uuid} from 'uuid';
import {SensorNotFound} from '../sensor/errors/SensorNotFound';


const newPlatformSchema = joi.object({
  id: joi.string(),
  name: joi.string().required(),
  description: joi.string(),
  static: joi.boolean().default(true),
  location: joi.object({
    geometry: joi.object({
      type: joi.string().required(),
      coordinates: joi.array().required()
    })
    .custom((value) => {
      validateGeometry(value); // throws an error if invalid
      return value;
    })
    .required()
  }),
  // N.B. it doesn't make sense to allow updateLocationWithSensor to be defined here, because we've only just created the platform and therefore there won't be any sensors on it yet that we can choose from.
  isHostedBy: joi.string(),
  ownerDeployment: joi.string().required()  
})
.required();

export async function createPlatform(platformClient: PlatformClient): Promise<PlatformClient> {

  const {error: validationErr, value: platform} = newPlatformSchema.validate(platformClient);
  if (validationErr) {
    throw new InvalidPlatform(validationErr.message);
  }

  const hostPlatformSpecified = check.assigned(platform.isHostedBy);
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

  const platformToCreate: any = cloneDeep(platform);
  platformToCreate.inDeployments = [platformToCreate.ownerDeployment];
  if (!idSpecified) {
    platformToCreate.id = nameToClientId(platformToCreate.name);
    logger.debug(`The platform name: '${platform.name}' has been converted to an id of '${platformToCreate.id}'`);
  }

  if (platformToCreate.location) {
    platformToCreate.location.validAt = new Date();
    if (!platformToCreate.location.id) {
      platformToCreate.location.id = uuid();
    }
  }

  if (hostPlatform) {

    // Add a hostedByPath if required
    if (hostPlatform.hostedByPath) {
      platformToCreate.hostedByPath = concat(hostPlatform.hostedByPath, hostPlatform.id);
    } else {
      platformToCreate.hostedByPath = [hostPlatform.id];
    }

    // Inherit the host platform's location (if it makes sense to do so)
    if (hostPlatform.location && !platformToCreate.location) {
      platformToCreate.location = cloneDeep(hostPlatform.location);
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


  const platformForClient = platformService.platformAppToClient(createdPlatform);
  return platformForClient;

}


export async function getPlatform(id: string): Promise<PlatformClient> {
  
  const platform: PlatformApp = await platformService.getPlatform(id);
  const platformForClient = platformService.platformAppToClient(platform);
  return platformForClient;

}


export async function getPlatforms(where: {inDeployment?: string}): Promise<PlatformClient[]> {

  const platforms: PlatformApp[] = await platformService.getPlatforms(where);
  logger.debug('Platforms found', platforms);

  // Now to make the platforms client friendly
  const platformsForClient = platforms.map((platform): PlatformClient => {
    const platformForClient = platformService.platformAppToClient(platform);
    return platformForClient;
  });

  return platformsForClient;

}


//-------------------------------------------------
// Update Platform
//-------------------------------------------------
const platformUpdatesSchema = joi.object({
  name: joi.string(),
  description: joi.string(),
  static: joi.boolean().valid(false), // for now I'll only allow static to be changed to mobile.
  location: joi.object({
    geometry: joi.object({
      type: joi.string().required(),
      coordinates: joi.array().required()
    })
    .custom((value) => {
      validateGeometry(value); // throws an error if invalid
      return value;
    })
    .required()
  }),
  updateLocationWithSensor: joi.string()
    .when('static', {is: true, then: joi.forbidden()}),
});
// N.B. this particular function only allows certain properties of a platform to be updated, i.e. direct features of a platform rather than its relationships with other things, e.g. other platforms and deployments. Other controller functions handle this.
export async function updatePlatform(id: string, updates: any): Promise<PlatformClient> {

  const {error: validationErr} = platformUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Get the platform
  const platformBeforeUpdate = await platformService.getPlatform(id);

  // I don't want a static platform having a updateLocationWithSensor property
  if (platformBeforeUpdate.static === true && updates.updateLocationWithSensor && updates.static !== false) {
    throw new BadRequest('You cannot set a updateLocationWithSensor property for a static platform');
  }

  if (updates.updateLocationWithSensor) {
    // Check the sensor exists
    // TODO: might want to check it's a sensor that can actually measure location too
    let sensor;
    try {
      sensor = await sensorService.getSensor(updates.updateLocationWithSensor);
    } catch (err) {
      if (err.name === 'SensorNotFound') {
        throw new SensorNotFound(`The sensor '${updates.updateLocationWithSensor}' provided as the value for 'updateLocationWithSensor' does not exist.`);
      } else {
        throw err;
      }
    }

    // Now we need to check if this sensor is actually hosted (directly or indirectly) on this platform.
    const relativePlatforms = await platformService.getRelativesOfPlatform(id);
    const relativePlatformIds = relativePlatforms.map((relativePlatform) => relativePlatform.id);
    if (sensor.isHostedBy !== id && !relativePlatformIds.includes(sensor.isHostedBy)) {
      throw new Forbidden(`The sensor '${sensor.id}' is not hosted (directly or indirectly) on the platform '${id}' and therefore cannot be used to update its location.`);
    }
  }

  const updatedPlatform = await platformService.updatePlatform(id, updates);
  const platformForClient = platformService.platformAppToClient(updatedPlatform);
  return platformForClient;

}


export async function unhostPlatform(id: string): Promise<PlatformApp> {

  const {platform: updatedPlatform, oldAncestors: oldAncestorsIds} = await platformService.unhostPlatform(id);
  await contextService.processPlatformHostChange(id, oldAncestorsIds, []);

  // Get the descendents of this now unhosted platform (if there are any)
  const descendents = await platformService.getDescendantsOfPlatform(id);
  const descendentIds = descendents.map((descendent) => descendent.id);

  // Get a list of all the sensors on the platform and its descendents
  const unhostedPlatformIds = concat([id], descendentIds);
  const sensors = await sensorService.getSensors({isHostedBy: {in: unhostedPlatformIds}});
  const sensorIds = sensors.map((sensor) => sensor.id);

  // Find all the platforms (i.e. including old relatives) that use these sensors to update their location
  const platformsUsingSensors = await platformService.getPlatforms({updateLocationWithSensor: {in: sensorIds}});
  const platformsUsingSensorsIds = platformsUsingSensors.map((platformUsingSensor) => platformUsingSensor.id);

  // Select those that were old relatives (N.B. I can't just use the oldAncestorsIds as there may be platforms down other branches of the platform tree using these sensors).
  const oldAncestorsUsingSensorsIds = difference(platformsUsingSensorsIds, unhostedPlatformIds);

  // Remove the updateLocationWithSensor of these old ancestors that used the sensors that are no longer hosted on their "tree".
  await Promise.map(oldAncestorsUsingSensorsIds, async (oldAncestorId): Promise<void> => {
    await platformService.updatePlatform(oldAncestorId, {updateLocationWithSensor: null});
  });  

  const platformForClient = platformService.platformAppToClient(updatedPlatform);
  return platformForClient;

}


export async function rehostPlatform(id: string, hostId: string): Promise<PlatformApp> {

  logger.debug(`About to rehost platform ${id} on ${hostId}`);

  const platform = await platformService.getPlatform(id);
  const hostPlatform = await platformService.getPlatform(hostId);

  // Enforce the rule that a static platform can't be hosted a mobile platform
  if (hostPlatform.static === false && platform.static === true) {
    throw new InvalidPlatform('A static platform cannot be hosted by a mobile platform.');
  }  

  // Check it's not already hosted on this platform
  if (platform.isHostedBy && platform.isHostedBy === hostId) {
    throw new Forbidden(`Platform ${id} is already hosted on platform ${hostId}.`);
  }

  const {platform: updatedPlatform, oldAncestors, newAncestors} = await platformService.rehostPlatform(id, hostId);

  logger.debug(`About to process the contexts following a platform host change.`, {id, oldAncestors, newAncestors});
  await contextService.processPlatformHostChange(id, oldAncestors, newAncestors);

  // - If hosted platform is static
  //     -> Do nothing, as static platforms can't have updateLocationWithSensor, and location should be defined. 
  // - If hosted platform is mobile:
  //     - If hosted platform has updateLocationWithSensor:
  //         - and the host platform is static 
  //             -> then do nothing.
  //         - and the host platform is mobile and does not have updateLocationWithSensor set:
  //             - Find any new relatives WITHOUT a updateLocationWithSensor property
  //                 -> and assign them the hosted platform's updateLocationWithSensor
  //     - If hosted platform does NOT have a updateLocationWithSensor property:
  //         --> Also get this hosted platform's children that don't have updateLocationWithSensor set
  //             --> set the location of these children and the hosted platform to that of the new host
  //             --> set the updateLocationWithSensor property as that of the new host (if available)

  if (platform.static === false) {

    if (platform.updateLocationWithSensor) {

      if (hostPlatform.static === false && !hostPlatform.updateLocationWithSensor) {

        const newRelativesUnfiltered = await platformService.getRelativesOfPlatform(id);
        // We don't want the hosted platform, or any of it's children in this array
        const newRelativesFiltered = newRelativesUnfiltered.filter((relative) => {
          if (relative.id === id) return false;
          if (relative.hostedByPath && relative.hostedByPath.includes(id)) return false;
          if (relative.updateLocationWithSensor) return false;
          return true;
        });
        await Promise.map(newRelativesFiltered, async (relative): Promise<void> => {
          await platformService.updatePlatform(relative.id, {
            updateLocationWithSensor: platform.updateLocationWithSensor
          });
        });

      }

    }

    if (!platform.updateLocationWithSensor) {

      const updatesForHosted: any = {};
      if (hostPlatform.location) {
        updatesForHosted.location = hostPlatform.location;
      }
      if (hostPlatform.updateLocationWithSensor) {
        updatesForHosted.updateLocationWithSensor = hostPlatform.updateLocationWithSensor;
      }

      if (Object.keys(updatesForHosted).length > 0) {

        const childrenOfPlatform = await platformService.getDescendantsOfPlatform(id);
        const childrenWithoutUpdateLocationWithSensor = childrenOfPlatform.filter((child) => {
          return !(child.updateLocationWithSensor);
        });
        const platformsThatShouldInherit = concat(platform, childrenWithoutUpdateLocationWithSensor);

        await Promise.map(platformsThatShouldInherit, async (platformToUpdate): Promise<void> => {
          await platformService.updatePlatform(platformToUpdate.id, updatesForHosted);
        });

      }

    }

  }

  logger.debug(`Platform ${id} has been successfully rehosted on ${hostId}.`);

  // Because the location of the rehosted platform may have been updated, let's get the platform again.
  const rehostedPlatform = await platformService.getPlatform(id);
  logger.debug('Rehosted platform', rehostedPlatform);
  const platformForClient = platformService.platformAppToClient(rehostedPlatform);
  return platformForClient;

}


// They'll probably be a few steps carried out before this function is run, e.g. a user of the platform's original deployment will need to send an invite to users of the new deployment, which they will need to accept, at which point this can function can be run.
export async function sharePlatformWithDeployment(platformId, deploymentId): Promise<PlatformClient> {

  // Get the deployment to check it exists
  await deploymentService.getDeployment(deploymentId);

  const updatedPlatform = await platformService.sharePlatformWithDeployment(platformId, deploymentId);

  // Now to update the context of sensors on this platform
  await contextService.processPlatformSharedWithDeployment(platformId, deploymentId);

  // TODO: It might be worth firing off a event-stream event following this. For example the observations-manager may wish to find all the timeseries for this platform and it's original deployment and add the new deployment to the inDeployments array.

  const platformForClient = platformService.platformAppToClient(updatedPlatform);
  return platformForClient;

}


export async function unsharePlatformWithDeployment(platformId, deploymentId): Promise<PlatformClient> {
  
  const updatedPlatform = await platformService.unsharePlatformWithDeployment(platformId, deploymentId);

  // Now to update the context of sensors on this platform
  await contextService.processPlatformUnsharedWithDeployment(platformId, deploymentId);

  const platformForClient = platformService.platformAppToClient(updatedPlatform);
  return platformForClient;

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

  return;

}
