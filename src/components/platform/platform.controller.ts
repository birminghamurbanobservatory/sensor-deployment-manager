import {PlatformClient} from './platform-client.class';
import * as deploymentService from '../deployment/deployment.service';
import * as platformService from '../platform/platform.service';
import {InvalidPlatform} from './errors/InvalidPlatform';
import * as check from 'check-types';
import {PlatformApp} from './platform-app.class';
import {PlatformNotFound} from './errors/PlatformNotFound';
import * as logger from 'node-logger';
import {labelToClientId} from '../../utils/label-to-client-id';
import {cloneDeep, concat, difference, sortBy} from 'lodash';
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
import * as permanentHostService from '../permanent-host/permanent-host.service';
import {CollectionOptions} from '../common/collection-options.interface';
import {PlatformIsDeleted} from './errors/PlatformIsDeleted';


const newPlatformSchema = joi.object({
  id: joi.string(),
  label: joi.string().required(),
  description: joi.string().allow(''),
  static: joi.boolean().default(true),
  location: joi.object({
    height: joi.number(),
    geometry: joi.object({
      type: joi.string().valid('Point').required(),
      // I don't want a z-coordinate in this coordinates array, this should come separately.
      coordinates: joi.array().length(2).required()
    })
    .custom((value) => {
      validateGeometry(value); // throws an error if invalid
      return value;
    })
    .required()
  }), // decided not to make the location required, even if the platform is static, this is partly because the static property isn't required and defaults to true, and therefore it would be confusing for a user to be force to set the location without setting static first, also the other way platforms are created is from permanentHosts, which don't have a location, and thus we need to support static platforms without a location anyway.
  // N.B. it doesn't make sense to allow updateLocationWithSensor to be defined here, because we've only just created the platform and therefore there won't be any sensors on it yet that we can choose from.
  passLocationToObservations: joi.boolean(),
  isHostedBy: joi.string(),
  inDeployment: joi.string().required()
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
  if (platform.inDeployment) {
    // These get functions will throw an error if the resource doesn't exists, which is what we want.
    await deploymentService.getDeployment(platform.inDeployment);
  }

  // Check the host platform exists
  let hostPlatform: PlatformApp;
  if (hostPlatformSpecified) {
    try {
      hostPlatform = await platformService.getPlatform(platform.isHostedBy);
    } catch (err) {
      if (err.name === 'PlatformNotFound') {
        throw new PlatformNotFound(`Could not find the platform '${platform.isHostedBy}' provided as the 'isHostedBy' property.`);
      } else if (err.name === 'PlatformIsDeleted') {
        throw new PlatformIsDeleted(`Cannot use platform '${platform.isHostedBy}' as a host. ${err.message}`);
      } else {
        throw err;
      }
    }

    // TODO: For now we'll just enforce that the new platform needs to be in the same deployment as the host platform. But in the future we might want to allow it to be hosted on a platform in a public network, or in a deployment that the user also has sufficient rights to.
    if (!(hostPlatform.inDeployment === platform.inDeployment)) {
      throw new InvalidPlatform(`The platform you wish to create has the deployment ${platform.inDeployment}, however the platform you wish to host it on is not associated with this deployment.`);
    }
  
    // Enforce the rule that a static platform can't be hosted a mobile platform
    if (hostPlatform.static === false && platform.static === true) {
      throw new InvalidPlatform('A static platform cannot be hosted by a mobile platform.');
    }

    logger.debug('Host Platform', hostPlatform);
  }

  const platformToCreate: any = cloneDeep(platform);
  if (!idSpecified) {
    platformToCreate.id = labelToClientId(platformToCreate.label);
    logger.debug(`The platform label: '${platform.label}' has been converted to an id of '${platformToCreate.id}'`);
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
    // If we generated an id from the label and this id is already taken then add a suffix and try again.
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


export async function getPlatform(id: string, options: {nest?: boolean} = {}): Promise<PlatformClient> {
  
  const platform: PlatformApp = await platformService.getPlatform(id);
  const platformForClient = platformService.platformAppToClient(platform);

  if (options.nest === true) {
    platformForClient.hosts = await getNestedHostsArrayForClient(id);
  } 

  return platformForClient;
}



// Given a platformId this will find all the platforms and sensors hosted on this platform. It can then be used as the "hosts" array for the returned platform. It will have a nested structure, e.g. if this platform hosts another platform that then hosts some other sensors then the child platform will itself have a hosts array.
export async function getNestedHostsArrayForApp(platformId: string): Promise<any[]> {

  // First let's find an sub-platforms, direct or indirect.
  const {data: subPlatforms} = await platformService.getPlatforms({hostedByPath: {includes: platformId}});

  // Now we know all the possible platformIds that sensors could be hosted on.
  const subPlatformIds = subPlatforms.map((platform) => platform.id);
  const allPlatformIds = concat(platformId, subPlatformIds);
  const {data: sensors} = await sensorService.getSensors({isHostedBy: {in: allPlatformIds}});

  // Now to build the nested structure
  const hostsArray = platformService.buildNestedHostsArray(platformId, subPlatforms, sensors);

  return hostsArray;

}


// Here we format the platforms and sensors to their client friendly form before passing them to the nesting function as it's easier than trying to do it once they are already nested.
export async function getNestedHostsArrayForClient(platformId: string): Promise<any[]> {

  // First let's find an sub-platforms, direct or indirect.
  const {data: subPlatforms} = await platformService.getPlatforms({hostedByPath: {includes: platformId}});
  const subPlatformsForClient = subPlatforms.map(platformService.platformAppToClient);

  // Now we know all the possible platformIds that sensors could be hosted on.
  const subPlatformIds = subPlatforms.map((platform) => platform.id);
  const allPlatformIds = concat(platformId, subPlatformIds);
  const {data: sensors} = await sensorService.getSensors({isHostedBy: {in: allPlatformIds}});
  const sensorsForClient = sensors.map(sensorService.sensorAppToClient);

  // Now to build the nested structure
  const hostsArray = platformService.buildNestedHostsArray(platformId, subPlatformsForClient, sensorsForClient);

  return hostsArray;

}


//-------------------------------------------------
// Get Platforms
//-------------------------------------------------
const getPlatformsWhereSchema = joi.object({
  inDeployment: joi.alternatives().try(
    joi.string(),
    joi.object({
      in: joi.array().items(joi.string()).min(1),
      exists: joi.boolean()
    }).min(1)
  ),
  id: joi.object({
    begins: joi.string(),
    in: joi.array().items(joi.string().min(1))
  }),
  isHostedBy: joi.alternatives().try(
    joi.string(),
    joi.object({
      in: joi.array().items(joi.string().min(1)),
      exists: joi.boolean() 
    }).min(1)
  ),
  hostedByPath: joi.alternatives().try(
    // TODO: accept an array here for allowing an exact match, or lquery style query.
    joi.object({
      includes: joi.string()
    })
  ),
  search: joi.string(),
  // Spatial queries
  boundingBox: joi.object({
    left: joi.number().min(-180).max(180).required(),
    right: joi.number().min(-180).max(180).required(),
    top: joi.number().min(-90).max(90).required(),
    bottom: joi.number().min(-90).max(90).required()
  }),
  height: joi.object({
    lt: joi.number(),
    lte: joi.number(),
    gt: joi.number(),
    gte: joi.number()
  }),
  proximity: joi.object({
    centre: joi.object({
      latitude: joi.number().min(-90).max(90).required(),
      longitude: joi.number().min(-180).max(180).required()
    }).required(),
    radius: joi.number().min(0).required() // in metres
  })
});

const getPlatformsOptionsSchema = joi.object({
  limit: joi.number().integer().positive(),
  offset: joi.number().integer().min(0),
  sortBy: joi.string().valid('id'),
  sortOrder: joi.string().valid('asc', 'desc'),
  includeDeleted: joi.boolean(),
  nest: joi.boolean()
}).required();

interface GetPlatformsOptions extends CollectionOptions {
  nest: boolean;
}

export async function getPlatforms(where: any = {}, options: GetPlatformsOptions): Promise<{data: PlatformClient[]; meta: {count: number; total: number}}> {

  const {error: whereErr, value: validWhere} = getPlatformsWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid where object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getPlatformsOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid options object: ${optionsErr.message}`);
  
  //------------------------
  // With Nesting
  //------------------------
  if (validOptions.nest) {

    // When nesting the limit will be applied to the number of platform "trees", so first we'll get the list of distinct topPlatforms that match the "where" criteria. The topPlatform is essentially an id for each "tree".
    const topPlatformIds = await platformService.getDistinctTopPlatformIds(validWhere);
    logger.debug('All distinct top platform ids that match where criteria', topPlatformIds);
    if (validOptions.sortOrder === 'desc') {
      topPlatformIds.reverse(); // mutates
    }
    const total = topPlatformIds.length;
    logger.debug(`total: ${total}`);

    const offset = check.assigned(validOptions.offset) ? validOptions.offset : 0;
    const limit = check.assigned(validOptions.limit) ? validOptions.limit : 100;
    logger.debug(`offset: ${offset}, limit: ${limit}.`);
    const selectedTopPlatformIds = topPlatformIds.slice(offset, limit + offset);
    logger.debug('selected top platform ids (i.e. those in this pagination page)', selectedTopPlatformIds);

    // Get all the platforms in the "trees" we've selected
    const {data: platforms} = await platformService.getPlatforms({topPlatform: {in: selectedTopPlatformIds}});
    const platformIds = platforms.map((platform) => platform.id);
    
    // Get all the sensors hosted on these platforms
    const {data: sensors} = await sensorService.getSensors({isHostedBy: {in: platformIds}});

    // It's easier to format the platforms and sensors for the client before nesting them
    const platformsForClient = platforms.map(platformService.platformAppToClient);
    const sensorsForClient = sensors.map(sensorService.sensorAppToClient);

    const nestedPlatformsForClient = platformService.buildNestedPlatformsArray(platformsForClient, sensorsForClient);
    const count = nestedPlatformsForClient.length;

    const nestedPlatformsForClientSorted = sortBy(nestedPlatformsForClient, 'id');
    if (validOptions.sortOrder === 'desc') {
      nestedPlatformsForClientSorted.reverse();
    }

    return {
      data: nestedPlatformsForClientSorted,
      meta: {
        count,
        total
      }
    };

  }

  //------------------------
  // Without Nesting
  //------------------------
  if (!validOptions.nest) {

    const {data: platforms, count, total} = await platformService.getPlatforms(validWhere, validOptions);
    logger.debug(`${platforms.length} platforms found`);

    // Now to make the platforms client friendly
    const platformsForClient = platforms.map(platformService.platformAppToClient);
    
    return {
      data: platformsForClient,
      meta: {
        count,
        total
      }
    };

  }


}


//-------------------------------------------------
// Update Platform
//-------------------------------------------------
const platformUpdatesSchema = joi.object({
  label: joi.string(),
  description: joi.string().allow(''),
  static: joi.boolean().valid(false), // for now I'll only allow static to be changed to mobile.
  location: joi.object({
    height: joi.number(),
    geometry: joi.object({
      type: joi.string().valid('Point').required(),
      coordinates: joi.array().length(2).required()
    })
    .custom((value) => {
      validateGeometry(value); // throws an error if invalid
      return value;
    })
    .required()
  }),
  updateLocationWithSensor: joi.string().allow(null)
    .when('static', {is: true, then: joi.forbidden()}),
  passLocationToObservations: joi.boolean()
});
// N.B. this particular function only allows certain properties of a platform to be updated, i.e. direct features of a platform rather than its relationships with other things, e.g. other platforms and deployments. Other controller functions handle this.
export async function updatePlatform(id: string, updates: any): Promise<PlatformClient> {

  const {error: validationErr, value: updatesToApply} = platformUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Get the platform
  const platformBeforeUpdate = await platformService.getPlatform(id);

  // I don't want a static platform having a updateLocationWithSensor property
  if (platformBeforeUpdate.static === true && updates.updateLocationWithSensor && updates.static !== false) {
    throw new BadRequest('You cannot set a updateLocationWithSensor property for a static platform');
  }

  if (updates.updateLocationWithSensor) {
    // Check the sensor exists
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

    // Now we need to check if this sensor is hosted on the same tree that this platform is on.
    const relativePlatforms = await platformService.getRelativesOfPlatform(id);
    const relativePlatformIds = relativePlatforms.map((relativePlatform) => relativePlatform.id);
    if (sensor.isHostedBy !== id && !relativePlatformIds.includes(sensor.isHostedBy)) {
      throw new Forbidden(`The sensor '${sensor.id}' is not hosted (directly or indirectly) on the platform '${id}' and therefore cannot be used to update its location.`);
    }
  }

  if (updates.location) {
    updatesToApply.location.validAt = new Date();
    if (!updates.location.id) {
      updatesToApply.location.id = uuid();
    }
  }

  const updatedPlatform = await platformService.updatePlatform(id, updatesToApply);
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
  const {data: sensors} = await sensorService.getSensors({isHostedBy: {in: unhostedPlatformIds}});
  const sensorIds = sensors.map((sensor) => sensor.id);

  // Find all the platforms (i.e. including old relatives) that use these sensors to update their location
  const {data: platformsUsingSensors} = await platformService.getPlatforms({updateLocationWithSensor: {in: sensorIds}});
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

  // Prevent a platform from being hosted on itself
  if (id === hostId) {
    throw new Forbidden('Hosting a platform on itself is not permitted');
  }

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
  //   - If hosted platform has no location
  //       -> Inherit the host platform's location
  //   - Otherwise 
  //       -> Do nothing, as static platforms can't have updateLocationWithSensor anyway.
  // - If hosted platform is mobile:
  //   - If hosted platform has updateLocationWithSensor:
  //     - and the host platform is static 
  //       -> then do nothing.
  //     - and the host platform is mobile and does not have updateLocationWithSensor set:
  //       - Find any new relatives WITHOUT a updateLocationWithSensor property
  //         -> and assign them the hosted platform's updateLocationWithSensor
  //   - If hosted platform does NOT have a updateLocationWithSensor property:
  //      --> Also get this hosted platform's children that don't have updateLocationWithSensor set
  //         --> set the location of these children and the hosted platform to that of the new host
  //         --> set the updateLocationWithSensor property as that of the new host (if available)

  if (platform.static === true) {
    if (!platform.location && hostPlatform.location) {
      await platformService.updatePlatform(platform.id, {location: hostPlatform.location});
    }
  }

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



export async function deletePlatform(id: string): Promise<void> {

  // Need some extra info about the platform before we can delete it.
  const platform = await platformService.getPlatform(id); 

  // Update any platforms that are hosted on this platform
  await platformService.cutDescendantsOfPlatform(id);

  // Delete the platform
  await platformService.deletePlatform(id);
  
  // Get all the sensors hosted on this platform
  const {data: sensors} = await sensorService.getSensors({isHostedBy: id});

  // Loop through each sensor
  await Promise.map(sensors, async (sensor) => {

    if (sensor.permanentHost) {
      // If the sensor is physically attached to this platform then we need to remove it from the deployment too
      await sensorService.removeSensorFromDeployment(sensor.id);
      // This will require a more drastic change to the context
      await contextService.processSensorRemovedFromDeployment(sensor.id, sensor.initialConfig);
    } else {
      await sensorService.removeSensorFromPlatform(sensor.id);
      await contextService.processSensorRemovedFromPlatform(sensor.id); 
    }

  });

  // The following will mop up any sensor's that weren't directly hosted on this platform, but whose context will need updating in order to remove the deleted platform from their hostedByPath.
  await contextService.processPlatformDeleted(id);

  // If the platform was generated from a permanentHost then we can set this permanentHost as being unregistered, and therefore free to be added to a different deployment.
  if (platform.initialisedFrom) {
    await permanentHostService.deregisterPermanentHost(platform.initialisedFrom);
  }

  return;

}



// This is aimed at users who have initialised a platform from a permanent host using a registration key. They want to release the sensors, but want to keep a record of the platform. I.e. this is an alternative to deleting the whole platform. 
// Deployment sensors will stay within the deployment, whereas permanentHost sensors will be removed from the deployment all together.
// This also updates the permanentHost's registeredAs property, allowing the permanentHost to be registered elsewhere.
export async function releasePlatformSensors(platformId: string): Promise<void> {

  // Get some extra info about the platform. It'll also throw an error if platform does not exist.
  const platform = await platformService.getPlatform(platformId); 
  
  // Get all the sensors directly hosted on this platform
  const {data: sensors} = await sensorService.getSensors({isHostedBy: platformId});

  // Loop through each sensor
  await Promise.map(sensors, async (sensor) => {

    if (sensor.permanentHost) {
      // If the sensor is physically attached to this platform then we need to remove it from the deployment too
      await sensorService.removeSensorFromDeployment(sensor.id);
      // This will require a more drastic change to the context
      await contextService.processSensorRemovedFromDeployment(sensor.id, sensor.initialConfig);
    } else {
      await sensorService.removeSensorFromPlatform(sensor.id);
      await contextService.processSensorRemovedFromPlatform(sensor.id);
    }

  });

  // If the platform was generated from a permanentHost then we can set this permanentHost as being unregistered, and therefore free to be added to a different deployment.
  if (platform.initialisedFrom) {
    await permanentHostService.deregisterPermanentHost(platform.initialisedFrom);
  }

  return;

}


