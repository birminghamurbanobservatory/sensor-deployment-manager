import Platform from './platform.model';
import {PlatformApp} from './platform-app.class';
import {PlatformClient} from './platform-client.class';
import {cloneDeep, concat} from 'lodash';
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
import {UnhostDescendentPlatformsFromNonSharedDeploymentsFail} from './errors/UnhostDescendentPlatformsFromNonSharedDeploymentsFail';
import {DeleteDeploymentPlatformsFail} from './errors/DeleteDeploymentPlatformsFail';
import {UnhostPlatformsFromOtherDeploymentsFail} from './errors/UnhostPlatformsFromOtherDeploymentsFail';
import {UnsharePlatformsSharedWithDeploymentFail} from './errors/UnsharePlatformsSharedWithDeploymentFail';
import {PlatformAlreadyInDeployment} from './errors/PlatformAlreadyInDeployment';
import {SharePlatformWithDeploymentFail} from './errors/SharePlatformWithDeploymentFail';
import {UnsharePlatformWithDeploymentFail} from './errors/UnsharePlatformWithDeploymentFail';
import {CannotUnshareFromOwnerDeployment} from './errors/CannotUnshareFromOwnerDeployment';
import {PlatformNotSharedWithDeployment} from './errors/PlatformNotSharedWithDeployment';
import {UpdatePlatformsWithLocationObservationFail} from './errors/UpdatePlatformsWithLocationObservationFail';
import {ObservationApp} from '../observation/observation-app.class';
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {RemoveSensorFromAnyMatchingUpdateLocationWithSensorFail} from './errors/RemoveSensorFromAnyMatchingUpdateLocationWithSensorFail';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';


export async function createPlatform(platform: PlatformApp): Promise<PlatformApp> {

  const platformDb = platformAppToDb(platform);

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



export async function getPlatform(id: string): Promise<PlatformApp> {

  let foundPlatform;
  try {
    foundPlatform = await Platform.findOne(
      {
        _id: id,
        deletedAt: {$exists: false}
      }
    ).exec();
  } catch (err) {
    throw new GetPlatformFail(undefined, err.message);
  }

  if (!foundPlatform) {
    throw new PlatformNotFound(`A platform with id '${id}' could not be found`);
  }

  return platformDbToApp(foundPlatform);

}


export async function getPlatforms(where: {inDeployment?: any; ownerDeployment?: string; isHostedBy?: any; updateLocationWithSensor?: any; id?: object} = {}): Promise<PlatformApp[]> {

  const findWhere = whereToMongoFind(where);
  findWhere.deletedAt = {$exists: false};

  // The db property is actually inDeployments not inDeployment
  if (findWhere.inDeployment) {
    findWhere.inDeployments = findWhere.inDeployment;
    delete findWhere.inDeployment;
  }

  let foundPlatforms;
  try {
    foundPlatforms = await Platform.find(findWhere).exec();
  } catch (err) {
    throw new GetPlatformsFail(undefined, err.message);
  }

  return (foundPlatforms.map(platformDbToApp));
}


export async function getPlatformsWithIds(ids: string[]): Promise<PlatformApp> {

  let foundPlatforms;
  try {
    foundPlatforms = await Platform.find({
      _id: {$in: ids},
      deletedAt: {$exists: false}
    }).exec();
  } catch (err) {
    throw new GetPlatformsFail(undefined, err.message);
  }

  return (foundPlatforms.map(platformDbToApp));

}



// I only want this function updating certain fields, i.e. not the isHostedBy property.
const updatesSchema = joi.object({
  name: joi.string(),
  description: joi.string(),
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
    newAncestors = concat(newAncestors, hostPlatform.hostedByPath);
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
    hostedByPath: newAncestors      
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
    }
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


// For example if a deployment is switched from public to private, we would need to find all platforms in other deployments that were hosted on its platforms and unhost them (unless they were shared with the deployment, in which case the deployment would be listed in the hostee platform's inDeployments array).
export async function unhostDescendentPlatformsFromNonSharedDeployments(deploymentId: string, deploymentPlatformIds: string[]): Promise<void> {

  await Promise.each(deploymentPlatformIds, async (deploymentPlatformId) => {

    // Find all the direct decendents of this platform that are NOT owned by, or shared with, the deployment.
    let directDecendents;
    try {
      directDecendents = await Platform.find({
        isHostedBy: deploymentPlatformId,
        inDeployments: {$nin: [deploymentId]}
      })
      .exec();
    } catch (err) {
      throw new UnhostDescendentPlatformsFromNonSharedDeploymentsFail(undefined, err.message);
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
        ownerDeployment: {$ne: deploymentId}
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


// This comes in handy when a deployment is deleted and thus any platforms shared with it should no longer be shared with it because theres no deployment left to be shared with
export async function unsharePlatformsSharedWithDeployment(deploymentId: string): Promise<void> {

  // So basically all we're doing is finding all the platforms which have this deployment in their inDeployments array, but don't have this deployment as their ownerDeployment, and pulling this deployment from the inDeployments array.
  try {
    await Platform.updateMany(
      {
        ownerDeployment: {$ne: deploymentId},
        inDeployments: deploymentId
      },
      {
        $pull: {inDeployments: deploymentId}
      }
    );    
  } catch (err) {
    throw new UnsharePlatformsSharedWithDeploymentFail(`Failed to unshare platforms shared with the deployment '${deploymentId}'.`, err.message);
  }  

}


export async function sharePlatformWithDeployment(platformId, deploymentId): Promise<PlatformApp> {

  logger.debug(`Sharing platform '${platformId}' with deployment '${deploymentId}'.`);

  // Let's first get this platform so we can check a few things (and check it exists)
  const platform = await getPlatform(platformId);

  if (platform.inDeployments.includes(deploymentId)) {
    throw new PlatformAlreadyInDeployment(`The platform '${platformId}' is already in the deployment '${deploymentId}' and therefore cannot be shared with it.`);
  }

  let updatedPlatform;
  try {
    updatedPlatform = await Platform.findByIdAndUpdate(
      platformId,
      {
        $push: {inDeployments: deploymentId}
      },
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new SharePlatformWithDeploymentFail(`Failed to share platform '${platformId}' with deployment '${deploymentId}'.`, err.message);
  }

  if (!updatedPlatform) {
    throw new PlatformNotFound(`A platform with id '${platformId}' could not be found`);
  }

  return platformDbToApp(updatedPlatform);

}


export async function unsharePlatformWithDeployment(platformId, deploymentId): Promise<PlatformApp> {
  
  // Let's first get this platform so we can check a few things (and check it exists)
  const platform = await getPlatform(platformId);

  if (platform.ownerDeployment === deploymentId) {
    throw new CannotUnshareFromOwnerDeployment(`The deployment ${deploymentId} owns the platform ${platformId}, thus the platform cannot be unshared with it.`);
  }

  if (!platform.inDeployments.includes(deploymentId)) {
    throw new PlatformNotSharedWithDeployment(`The platform '${platformId}' is not shared with the deployment '${deploymentId}' and therefore cannot be unshared from it.`);
  }

  let updatedPlatform;
  try {
    updatedPlatform = await Platform.findByIdAndUpdate(
      platformId,
      {
        $pull: {inDeployments: deploymentId}
      },
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new UnsharePlatformWithDeploymentFail(`Failed to share platform '${platformId}' with deployment '${deploymentId}'.`, err.message);
  }

  if (!updatedPlatform) {
    throw new PlatformNotFound(`A platform with id '${platformId}' could not be found`);
  }

  return platformDbToApp(updatedPlatform);

}


// A soft delete
export async function deletePlatform(id: string): Promise<void> {

  const updates = {
    inDeployments: [],
    deletedAt: new Date(),
    $unset: {
      isHostedBy: '',
      hostedByPath: ''
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
    inDeployments: [],
    deletedAt: new Date(),
    $unset: {
      isHostedBy: '',
      hostedByPath: ''
    }
  };

  try {
    await Platform.updateMany(
      {
        ownerDeployment: deploymentId
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
    // For distant descendants (grandchildren, etc)
    } else {
      const idx = descendant.hostedByPath.indexOf(id);
      updates.hostedByPath = descendant.hostedByPath.slice(idx + 1, descendant.hostedByPath.length);
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
  if (check.not.nonEmptyArray(observation.inDeployments)) {
    throw new Error('The observation must have an inDeployments array in order to update platform locations');
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


  let results;
  try {
    results = await Platform.updateMany({
      updateLocationWithSensor: observation.madeBySensor,
      inDeployments: {$in: observation.inDeployments},
      $or: [
        {location: {$exists: false}},
        {'location.validAt': {$lt: observation.location.validAt}},
      ]
    }, {
      location: observation.location
    }); 
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



function platformAppToDb(platformApp: PlatformApp): object {
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
  platformClient.createdAt = platformClient.createdAt.toISOString();
  platformClient.updatedAt = platformClient.updatedAt.toISOString();
  return platformClient;
} 


export function platformClientToApp(platformClient: PlatformClient): PlatformApp {
  const platformApp: any = cloneDeep(platformClient);
  return platformApp; 
}