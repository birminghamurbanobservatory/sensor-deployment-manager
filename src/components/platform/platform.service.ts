import Platform from './platform.model';
import {PlatformApp} from './platform-app.class';
import {PlatformClient} from './platform-client.class';
import {cloneDeep, concat, pullAllBy, sortBy, groupBy, omit} from 'lodash';
import {PlatformAlreadyExists} from './errors/PlatformAlreadyExists';
import {InvalidPlatform} from './errors/InvalidPlatform';
import {CreatePlatformFail} from './errors/CreatePlatformFail';
import {GetPlatformFail} from './errors/GetPlatformFail';
import {PlatformNotFound} from './errors/PlatformNotFound';
import {GetPlatformsFail} from './errors/GetPlatformsFail';
import {DeletePlatformFail} from './errors/DeletePlatformFail';
import {UpdatePlatformFail} from './errors/UpdatePlatformFail';
import {UnhostPlatformFail} from './errors/UnhostPlatformFail';
import {RehostPlatformFail} from './errors/RehostPlatformFail';
import * as check from 'check-types';
import {GetDescendantsOfPlatformFail} from './errors/GetDecendantsOfPlatformFail';
import * as Promise from 'bluebird';
import {CutDescendantsOfPlatformFail} from './errors/CutDescendantsOfPlatformFail';
import * as joi from '@hapi/joi';
import {PlatformAlreadyUnhosted} from './errors/PlatformAlreadyUnhosted';
import * as logger from 'node-logger';
import {UnhostDescendentPlatformsFromOtherDeploymentsFail} from './errors/unhostDescendentPlatformsFromOtherDeploymentsFail';
import {DeleteDeploymentPlatformsFail} from './errors/DeleteDeploymentPlatformsFail';
import {UnhostPlatformsFromOtherDeploymentsFail} from './errors/UnhostPlatformsFromOtherDeploymentsFail';
import {UpdatePlatformsWithLocationObservationFail} from './errors/UpdatePlatformsWithLocationObservationFail';
import {ObservationApp} from '../observation/observation-app.class';
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {RemoveSensorFromAnyMatchingUpdateLocationWithSensorFail} from './errors/RemoveSensorFromAnyMatchingUpdateLocationWithSensorFail';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';
import {SensorApp} from '../sensor/sensor-app.class';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import {GetDistinctTopPlatformsFail} from './errors/GetDistinctTopPlatformsFail';
import {SensorClient} from '../sensor/sensor-client.class';
import {CollectionOptions} from '../common/collection-options.class';


export async function createPlatform(platform: PlatformApp): Promise<PlatformApp> {

  const platformToCreate = cloneDeep(platform);
  platformToCreate.topPlatform = deriveTopPlatformFromPlatform(platformToCreate);
  const platformDb = platformAppToDb(platformToCreate);

  let createdPlatform;
  try {
    createdPlatform = await Platform.create(platformDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new PlatformAlreadyExists(`A platform with an id of '${platform.id}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidPlatform(err.message);
    } else {
      throw new CreatePlatformFail(undefined, err.message);
    }
  }

  return platformDbToApp(createdPlatform);

}


function deriveTopPlatformFromPlatform(platform: PlatformApp): string {

  let topPlatformId;

  if (!platform.isHostedBy) {
    topPlatformId =  platform.id;
  }

  if (platform.isHostedBy && check.nonEmptyArray(platform.hostedByPath)) {
    topPlatformId = platform.hostedByPath[0];
  }

  if (!topPlatformId) {
    throw new Error('Unable to derive a topPlatform from the platform');
  }

  return topPlatformId;

}



export async function getPlatform(id: string, options: {includeDeleted?: boolean} = {}): Promise<PlatformApp> {

  const findWhere: any = {_id: id};
  
  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  let foundPlatform;
  try {
    foundPlatform = await Platform.findOne(findWhere).exec();
  } catch (err) {
    throw new GetPlatformFail(undefined, err.message);
  }

  if (!foundPlatform) {
    throw new PlatformNotFound(`A platform with id '${id}' could not be found`);
  }

  return platformDbToApp(foundPlatform);

}



export async function getPlatforms(
  where: {
    inDeployment?: any;
    isHostedBy?: any; 
    updateLocationWithSensor?: any; 
    id?: object; 
    hostedByPath?: any; 
    topPlatform?: any;
    boundingBox?: any
    height?: any;
    proximity?: any;
  } = {}, 
  options: CollectionOptions = {}
): Promise<{data: PlatformApp[]; count: number; total: number}> {

  const spatialKeys = ['boundingBox', 'height', 'proximity'];
  const spatialPart: any = buildSpatialFindQueryForPlatforms(where);
  const whereWithoutSpatialParts = omit(where, spatialKeys);
  const normalPart = whereToMongoFind(whereWithoutSpatialParts);
  const findWhere = Object.assign({}, normalPart, spatialPart);
  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);

  logger.debug('Find object for getPlatforms', findWhere);

  let platforms;
  try {
    platforms = await Platform.find(findWhere, null, findOptions).exec();
  } catch (err) {
    throw new GetPlatformsFail(undefined, err.message);
  }

  const count = platforms.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await Platform.countDocuments(findWhere);
    }
  } else {
    total = count;
  }

  const platformsForApp = platforms.map(platformDbToApp);

  return {
    data: platformsForApp,
    count,
    total
  };

}


export async function getDistinctTopPlatformIds(where = {}, options: {includeDeleted?: boolean} = {}): Promise<string[]> {

  const spatialKeys = ['latitude', 'longitude', 'height', 'proximity'];
  const spatialPart: any = buildSpatialFindQueryForPlatforms(where);
  const whereWithoutSpatialParts = omit(where, spatialKeys);
  const normalPart = whereToMongoFind(whereWithoutSpatialParts);
  const findWhere = Object.assign({}, normalPart, spatialPart);
  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  let distinctTopPlatformIds;
  try {
    distinctTopPlatformIds = await Platform.distinct('topPlatform', findWhere).exec();
  } catch (err) {
    throw new GetDistinctTopPlatformsFail(undefined, err.message);
  }

  // Worth returning them in sorted order
  const sortedDistinctTopPlatformIds = sortBy(distinctTopPlatformIds);

  return sortedDistinctTopPlatformIds;

}



export function buildSpatialFindQueryForPlatforms(where: any): any {

  // Platforms have a location, and therefore there's some spatial components to the where object that need converting to a mongodb find object that can't be handled by the whereToMongoFind function because they are specific to platforms.
  const geometryKey = 'location.geometry';
  const findWhere = {};
  
  // Create a bounding box and look for GeoJSON locations within it.
  if (where.boundingBox) {
    logger.debug('Using a $geoWithin bounding box');
    findWhere[geometryKey] = {
      $geoWithin: {
        $geometry: {
          type: 'Polygon',
          coordinates: [[
            [where.boundingBox.left, where.boundingBox.bottom],
            [where.boundingBox.left, where.boundingBox.top],
            [where.boundingBox.right, where.boundingBox.top],
            [where.boundingBox.right, where.boundingBox.bottom],
            [where.boundingBox.left, where.boundingBox.bottom] // need to repeat the first point
          ]]
        }
      }
    };
  }

  // Height
  if (check.nonEmptyObject(where.height)) {
    const heightKey = `location.height`;
    findWhere[heightKey] = {};
    Object.keys(where.height).forEach((comparatorKey) => {
      findWhere[heightKey][`$${comparatorKey}`] = where.height[comparatorKey];
    });
  }

  // Proximity
  if (where.proximity) {
    findWhere[geometryKey] = {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [where.proximity.centre.longitude, where.proximity.centre.latitude]
        },
        $maxDistance: where.proximity.radius  // in metres
      }
    };
  }

  return findWhere;

}


export async function getPlatformsWithIds(ids: string[], options: {includeDeleted?: boolean} = {}): Promise<PlatformApp> {

  const findWhere: any = {
    _id: {$in: ids}
  };

  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  let foundPlatforms;
  try {
    foundPlatforms = await Platform.find(findWhere).exec();
  } catch (err) {
    throw new GetPlatformsFail(undefined, err.message);
  }

  return (foundPlatforms.map(platformDbToApp));

}



// I only want this function updating certain fields, i.e. not the isHostedBy property.
const updatesSchema = joi.object({
  name: joi.string(),
  description: joi.string().allow(''),
  static: joi.boolean(),
  location: joi.any(),
  updateLocationWithSensor: joi.string().allow(null)
});

export async function updatePlatform(id, updates: {name?: string; description?: string; static?: boolean; location?: any; updateLocationWithSensor?: string}): Promise<PlatformApp> {

  joi.attempt(updates, updatesSchema); // throws error if invalid

  const updatesModified = replaceNullUpdatesWithUnset(updates);

  let updatedPlatform;
  try {
    updatedPlatform = await Platform.findOneAndUpdate(
      {
        _id: id,
        deletedAt: {$exists: false}
      },
      updatesModified,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new UpdatePlatformFail(undefined, err.message);
  }

  if (!updatedPlatform) {
    throw new PlatformNotFound(`A platform with id '${id}' could not be found`);
  }

  return platformDbToApp(updatedPlatform);  

}


// Not only does this update this platform, but if this platform has any descendents then their hostedByPath will be updated too.
// Also works if the platform isn't yet hosted.
export async function rehostPlatform(id: string, hostId?: string): Promise<{platform: PlatformApp; oldAncestors: string[]; newAnestors: string[]}> {

  // First get the platform so we can see what ancestors it has
  const existingPlatform = await getPlatform(id);

  // Get the host platforms (errors if it doesn't exist)
  const hostPlatform = await getPlatform(hostId);
  let newAncestors = [hostPlatform.id];
  if (hostPlatform.hostedByPath) {
    newAncestors = concat(hostPlatform.hostedByPath, newAncestors);
  }

  logger.debug(`New ancestors for platform ${id}`, newAncestors);

  // If the platform was already hosted then we need to update its decendents first as we can't do a $pull and a $push in the same request.
  let oldAncestors = [];
  if (existingPlatform.isHostedBy) {
    oldAncestors = existingPlatform.hostedByPath;
    try {
      // Basically we're looking for any platforms whose hostedByPath includes the unhosted platform and pulling out the oldAncestors from it.
      await Platform.updateMany(
        {
          hostedByPath: id
        },
        {
          $pull: {hostedByPath: {$in: oldAncestors}}
        }
      );    
    } catch (err) {
      throw new UnhostPlatformFail(undefined, err.message);
    }
  }

  // Now to add the new ancestors to all of the platform's descendent's hostedByPath arrays.
  try {
    await Platform.updateMany(
      {
        hostedByPath: id
      },
      {
        topPlatform: newAncestors[0],
        $push: {
          hostedByPath: {
            $each: newAncestors,
            $position: 0 // adds them to the beginning of the array
          }
        }
      }
    );    
  } catch (err) {
    throw new RehostPlatformFail(undefined, err.message);
  }  

  // Now to update the platform itself
  const updates: any = {
    isHostedBy: hostId,
    hostedByPath: newAncestors,
    topPlatform: newAncestors[0]      
  };

  let updatedPlatform;
  try {
    updatedPlatform = await Platform.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new RehostPlatformFail(undefined, err.message);
  }

  if (!updatedPlatform) {
    throw new PlatformNotFound(`A platform with id '${id}' could not be found`);
  }

  return {
    platform: platformDbToApp(updatedPlatform),
    oldAncestors,
    newAncestors
  };

}


// Not only does this update this platform, but if this platform has any descendents then their hostedByPath is updated too.
export async function unhostPlatform(id): Promise<{platform: PlatformApp; oldAncestors: string[]}> {

  // First get the platform so we can see what ancestors it has
  const existingPlatform = await getPlatform(id);

  if (!existingPlatform.isHostedBy) {
    throw new PlatformAlreadyUnhosted(`Platform '${id}' is already unhosted.`);
  }

  const oldAncestors = existingPlatform.hostedByPath;

  // Now to update the platform document
  const updates = {
    $unset: {
      isHostedBy: '',
      hostedByPath: ''     
    },
    topPlatform: id
  };

  let updatedPlatform;
  try {
    updatedPlatform = await Platform.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new UnhostPlatformFail(undefined, err.message);
  }

  if (!updatedPlatform) {
    throw new PlatformNotFound(`A platform with id '${id}' could not be found`);
  }

  // Now to update the hostedByPath of all descendents
  try {
    // Basically we're looking for any platforms whose hostedByPath includes the unhosted platform and pulling out the ancestors from it.
    await Platform.updateMany(
      {
        hostedByPath: id
      },
      {
        topPlatform: id,
        $pull: {hostedByPath: {$in: oldAncestors}}
      }
    );    
  } catch (err) {
    throw new UnhostPlatformFail(undefined, err.message);
  }

  return {
    platform: platformDbToApp(updatedPlatform),
    oldAncestors
  };   

}


// For example if a deployment is switched from public to private, we would need to find all platforms in other deployments that were hosted on its platforms and unhost them.
export async function unhostDescendentPlatformsFromOtherDeployments(deploymentId: string, deploymentPlatformIds: string[]): Promise<void> {

  await Promise.each(deploymentPlatformIds, async (deploymentPlatformId) => {

    // Find all the direct decendents of this platform that are NOT owned by this deployment.
    let directDecendents;
    try {
      directDecendents = await Platform.find({
        isHostedBy: deploymentPlatformId,
        inDeployment: {$nin: [deploymentId]}
      })
      .exec();
    } catch (err) {
      throw new UnhostDescendentPlatformsFromOtherDeploymentsFail(undefined, err.message);
    }

    // Now to unhost each of these direct descendents (also updates the hostedByPath of distant descendents)
    await Promise.each(directDecendents, async (directDescendent) => {
      await unhostPlatform(directDescendent.id);
    });

  });
  
}

// Typically used when a deployment is deleted and thus any platforms from other deployments that were hosted on its platforms will need to be unhosted.
export async function unhostPlatformsFromOtherDeployments(deploymentId: string, deploymentPlatformIds: string[]): Promise<void> {

  await Promise.each(deploymentPlatformIds, async (deploymentPlatformId) => {

    // Find all the direct decendents of this platform that are NOT owned by the deployment.
    let directDecendents;
    try {
      directDecendents = await Platform.find({
        isHostedBy: deploymentPlatformId,
        inDeployment: {$ne: deploymentId}
      })
      .exec();
    } catch (err) {
      throw new UnhostPlatformsFromOtherDeploymentsFail(undefined, err.message);
    }

    // Now to unhost each of these direct descendents (also updates the hostedByPath of distance descendents)
    await Promise.each(directDecendents, async (directDescendent) => {
      await unhostPlatform(directDescendent.id);
    });

  });
  
}



// A soft delete
export async function deletePlatform(id: string): Promise<void> {

  const updates = {
    deletedAt: new Date(),
    $unset: {
      isHostedBy: '',
      hostedByPath: '',
      inDeployment: ''
    }
  };

  let deletedPlatform;
  try {
    deletedPlatform = await Platform.findOneAndUpdate(
      {
        _id: id,
        deletedAt: {$exists: false}
      },
      updates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new DeletePlatformFail(`Failed to delete Platform '${id}'.`, err.message);
  }

  if (!deletedPlatform) {
    throw new PlatformNotFound(`A platform with id '${id}' could not be found`);
  }

  return;

}


// soft delete
export async function deleteDeploymentPlatforms(deploymentId: string): Promise<void> {

  const updates = {
    deletedAt: new Date(),
    $unset: {
      isHostedBy: '',
      hostedByPath: '',
      inDeployment: ''
    }
  };

  try {
    await Platform.updateMany(
      {
        inDeployment: deploymentId
      },
      updates
    ).exec();
  } catch (err) {
    throw new DeleteDeploymentPlatformsFail(`Failed to delete platforms owned by deployment '${deploymentId}'.`, err.message);
  }

  return;

}



export async function getDescendantsOfPlatform(id: string): Promise<PlatformApp[]> {

  const findWhere: any = {
    hostedByPath: id,
    deletedAt: {$exists: false}
  };

  let foundPlatforms;
  try {
    foundPlatforms = await Platform.find(findWhere).exec();
  } catch (err) {
    throw new GetDescendantsOfPlatformFail(undefined, err.message);
  }

  return (foundPlatforms.map(platformDbToApp));

}


// Get all relatives, anywhere on this platform's "tree". E.g. could be on a different "branch" and therefore wouldn't appear in the platform's hostedByPath, or could be a descendent of this platform.
export async function getRelativesOfPlatform(id: string): Promise<PlatformApp[]> {

  // Crucially you first have to find the highest ancestor and then search for any platforms with this platform it their hostedByPath.
  const platform = await getPlatform(id);

  let highestAncestorId;
  if (!platform.isHostedBy) {
    // If the platform has no ancestors then the highest must be this platform itself.
    highestAncestorId = id;
  } else {
    highestAncestorId = platform.hostedByPath[0];
  }

  const relativesUnfiltered = await getDescendantsOfPlatform(highestAncestorId);
  if (highestAncestorId !== id) {
    const highestAncestor = await getPlatform(highestAncestorId);
    relativesUnfiltered.unshift(highestAncestor);
  }

  // Remove the platform itself from the array
  const relativesFiltered = relativesUnfiltered.filter((relative) => relative.id !== id);
  return relativesFiltered; 

}



export async function cutDescendantsOfPlatform(id: string): Promise<void> {

  const descendants = await getDescendantsOfPlatform(id);

  await Promise.each(descendants, async (descendant) => {

    const updates: any = {};

    // For descendants hosted directly on the platform they'll no longer be hosted on anything
    if (descendant.isHostedBy === id) {
      updates.$unset = {isHostedBy: '', hostedByPath: ''};
      updates.topPlatform = descendant.id;
    // For distant descendants (grandchildren, etc)
    } else {
      const idx = descendant.hostedByPath.indexOf(id);
      const newHostedByPath = descendant.hostedByPath.slice(idx + 1, descendant.hostedByPath.length);
      updates.hostedByPath = newHostedByPath;
      updates.topPlatform = newHostedByPath[0];
    }

    // Update this decendant
    try {
      await Platform.findByIdAndUpdate(
        descendant.id,
        updates,
        {
          new: true,
          runValidators: true
        }
      ).exec();
    } catch (err) {
      throw new CutDescendantsOfPlatformFail(undefined, err.message);
    }

    return;

  });

}


export async function updatePlatformsWithLocationObservation(observation: ObservationApp): Promise<void> {

  // It's important that the observation's deployments form part of the query otherwise a platform's location could end up being updated by a sensor which was/is in a deployment that the users of the platform's deployment don't have access to.
  if (check.not.nonEmptyString(observation.hasDeployment)) {
    throw new Error('The observation must have hasDeployment defined in order to update platform locations');
  }

  if (check.not.nonEmptyString(observation.madeBySensor)) {
    throw new Error('The observation must have a madeBySensor property in order to update platform locations');
  }

  if (check.not.nonEmptyObject(observation.location)) {
    throw new Error('Location object must be a non-empty object');
  }

  if (check.not.date(observation.location.validAt)) {
    throw new Error(`Observation location must have a valid 'validAt' date`);
  }

  if (observation.location.validAt.getTime() > ((new Date()).getTime() + 5000)) {
    throw new Error('Observation location has a validAt time in the future');
  }

  if (check.not.nonEmptyObject(observation.location.geometry)) {
    throw new Error(`Observation location must have a 'geometry' object`);
  }

  if (check.not.nonEmptyString(observation.location.id)) {
    throw new Error(`Observation location must have a valid 'id'.`);
  }

  const updates: any = {};
  updates.location = cloneDeep(observation.location);

  let results;
  try {
    results = await Platform.updateMany({
      updateLocationWithSensor: observation.madeBySensor,
      inDeployment: observation.hasDeployment,
      $or: [
        {location: {$exists: false}},
        {'location.validAt': {$lt: observation.location.validAt}},
      ]
    }, updates); 
  } catch (err) {
    throw new UpdatePlatformsWithLocationObservationFail(undefined, err.message);
  }
  
  logger.debug(`Modified ${results.nModified} platforms in response to a location observation.`);
  
  return;

}


export async function removeSensorFromAnyMatchingUpdateLocationWithSensor(sensorId: string): Promise<void> {

  let results;
  try {
    results = await Platform.updateMany(
      {
        updateLocationWithSensor: sensorId
      },
      {
        $unset: {updateLocationWithSensor: ''}
      },
    ).exec();
  } catch (err) {
    throw new RemoveSensorFromAnyMatchingUpdateLocationWithSensorFail(undefined, err.message);
  }

  logger.debug(`Removed the sensor '${sensorId}' from the updateLocationWithSensor property of ${results.nModified} platforms`);

  return;

}


export function buildNestedHostsArray(topPlatformId: string, subPlatforms: PlatformApp[], sensors: SensorApp[]): any[] {

  // Quick check to make sure the platforms provided are all in this ancestry
  const subPlatformIds = subPlatforms.map((platform) => platform.id);
  const allPlatformIds = concat(topPlatformId, subPlatformIds);
  subPlatforms.forEach((subPlatform) => {
    if (!subPlatform.isHostedBy || !allPlatformIds.includes(subPlatform.isHostedBy)) {
      throw new Error(`The isHostedBy property of Platform '${subPlatform.id}' is '${subPlatform.isHostedBy}, which does not exist in this ancentry.'`);
    }
  });
  // Also check this for the sensors
  sensors.forEach((sensor) => {
    if (!sensor.isHostedBy || !allPlatformIds.includes(sensor.isHostedBy)) {
      throw new Error(`The isHostedBy property of Sensor '${sensor.id}' is '${sensor.isHostedBy}', which does not exist in this ancentry.'`);
    }
  });
  // Also check that if a platform has a isHostedBy field, that it also has a hostedByPath array
  subPlatforms.forEach((platform) => {
    if (platform.isHostedBy) {
      if (!platform.hostedByPath) {
        throw new Error(`The platform '${platform.id}' has a isHostedBy property defined, but is missing a hostedByPath array.`);
      }
      const lastPlatformInHostedByPath = platform.hostedByPath[platform.hostedByPath.length - 1];
      if (lastPlatformInHostedByPath !== platform.isHostedBy) {
        throw Error(`Expected the final platform in the hostedByPath array of platform '${platform.id}' to be the same as its isHostedBy value of '${platform.isHostedBy}', but instead found '${lastPlatformInHostedByPath}'.`);
      }
    }
  });

  let hostsArray = [];

  // Add any sensors directly bound to the top level platform
  const remainingSensors: any[] = cloneDeep(sensors);
  remainingSensors.forEach((sensor) => sensor.type = 'sensor');
  const sensorsDirectlyOnTopPlatform = remainingSensors.filter((sensor) => sensor.isHostedBy === topPlatformId);
  // The following mutates the remainingSensors array, removing these directly hosted sensors.
  pullAllBy(remainingSensors, [{isHostedBy: topPlatformId}], 'isHostedBy'); 
  hostsArray = concat(hostsArray, sensorsDirectlyOnTopPlatform);

  // N.B. we need to add a type property, otherwise it's not clear what's a sensor and whats a platform.
  const platformsWithType: any[] = cloneDeep(subPlatforms);
  platformsWithType.forEach((platform) => platform.type = 'platform');

  // Before we start nesting platforms, let's assign any sensors they host to their hosts array
  platformsWithType.forEach((platform) => {
    const sensorsHostedByPlatform = remainingSensors.filter((sensor) => sensor.isHostedBy === platform.id);
    if (sensorsHostedByPlatform.length > 0) {
      platform.hosts = sensorsHostedByPlatform;
    }
  });

  const platformsNested = organiseSubLevelPlatforms(platformsWithType);
  hostsArray = concat(hostsArray, platformsNested);
  return hostsArray;

}


export function organiseSubLevelPlatforms(platforms: PlatformClient[]): any[] {

  // For the platforms the number of elements in the hostedByPath tells you how deep it is in ancestry "tree".
  const nLevels = platforms.reduce((deepestSoFar, platform) => {
    if (platform.hostedByPath) {
      return Math.max(deepestSoFar, platform.hostedByPath.length);
    } else {
      return deepestSoFar;
    }
  }, 0);

  // Let's organise our platforms by how deep they are
  // e.g. [[{parent-1}, {parent-2}], [{child-1}, {child-2}, {child-3}]]
  const platformsLevelled = [];
  for (let i = 0; i < nLevels; i++) {
    const hostedByPathLength = i + 1;
    const thisLevelsPlatforms = platforms.filter((platform) => {
      return platform.hostedByPath && platform.hostedByPath.length === hostedByPathLength;
    });
    platformsLevelled.push(thisLevelsPlatforms);
  }

  let platformsNested = [];

  if (platformsLevelled.length === 1) {
    platformsNested = platformsLevelled[0];
  }

  if (platformsLevelled.length > 1) {
    // We want to go through in reverse, adding platforms from the next level deeper as hosts to the current level, so that by the end platformsLevelled[0] contains the complete nested structure.
    for (let i = platformsLevelled.length - 2; i >= 0; i--) {
      platformsLevelled[i].forEach((hostPlatform) => {
        const hosteePlatforms = platformsLevelled[i + 1].filter((hosteePlatform) => hosteePlatform.isHostedBy === hostPlatform.id);
        if (hosteePlatforms.length > 0) {
          if (hostPlatform.hosts) {
            // This accounts for if the platform already has sensors hosted on it.
            hostPlatform.hosts = concat(hostPlatform.hosts, hosteePlatforms);
          } else {
            hostPlatform.hosts = hosteePlatforms;
          }
        }
      });
    }
    platformsNested = platformsLevelled[0];
  }

  return platformsNested;

}


export function buildNestedPlatformsArray(allPlatforms: PlatformClient[], allSensors: SensorClient[]): any {

  // Assign a type property so we can distinguish sensors from platforms in the hosts arrays
  const sensorsWithType = allSensors.map((sensor) => {
    const sensorWithType = cloneDeep(sensor);
    sensorWithType.type = 'sensor';
    return sensorWithType;
  });

  // Before we start nesting platforms, let's assign any sensors they host to their hosts array
  const sensorsGrouped = groupBy(sensorsWithType, 'isHostedBy');
  const platformsWithSensors = allPlatforms.map((platform) => {
    const platformWithSensor = cloneDeep(platform);
    platformWithSensor.hosts = sensorsGrouped[platform.id] || [];
    return platformWithSensor;
  });

  // Get all the top level platforms
  const topLevelPlatforms = platformsWithSensors.filter((platform) => {
    return check.not.assigned(platform.isHostedBy);
  });
  // Get all the sub level platforms (and add a type field)
  const subLevelPlatforms = platformsWithSensors.filter((platform) => {
    return check.assigned(platform.isHostedBy);
  }).map((platform) => {
    platform.type = 'platform';
    return platform;
  });

  // this creates an object with the topPlatform ids as the keys.
  const subPlatformsGrouped = groupBy(subLevelPlatforms, 'topPlatform'); 

  const nestedPlatformsArray = topLevelPlatforms.map((topLevelPlatform) => {

    if (subPlatformsGrouped[topLevelPlatform.id]) {
      const organisedSubPlatforms = organiseSubLevelPlatforms(subPlatformsGrouped[topLevelPlatform.id]);
      // Account for the fact the top level platform might already have some sensors in its hosts array.
      topLevelPlatform.hosts = concat(topLevelPlatform.hosts, organisedSubPlatforms);
    }

    return topLevelPlatform;

  });

  return nestedPlatformsArray;

}



function platformAppToDb(platformApp: PlatformApp): any {
  const platformDb: any = cloneDeep(platformApp);
  platformDb._id = platformApp.id;
  delete platformDb.id;
  return platformDb;
}


function platformDbToApp(platformDb: any): PlatformApp {
  const platformApp = platformDb.toObject();
  platformApp.id = platformApp._id.toString();
  delete platformApp._id;
  delete platformApp.__v;
  if (platformApp.location) {
    delete platformApp.location._id;
  }
  return platformApp;
}


export function platformAppToClient(platformApp: PlatformApp): PlatformClient {
  const platformClient: any = cloneDeep(platformApp);
  delete platformClient.initialisedFrom;
  if (platformClient.location && platformClient.location.validAt) {
    platformClient.location.validAt = platformClient.location.validAt.toISOString();
  }  
  if (check.assigned(platformClient.createdAt)) {
    platformClient.createdAt = platformClient.createdAt.toISOString();
  }
  if (check.assigned(platformClient.updatedAt)) {
    platformClient.updatedAt = platformClient.updatedAt.toISOString();
  }
  return platformClient;
} 


export function platformClientToApp(platformClient: PlatformClient): PlatformApp {
  const platformApp: any = cloneDeep(platformClient);
  return platformApp; 
}