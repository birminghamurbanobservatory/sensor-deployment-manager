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
import {PlatformLocationApp} from '../platform-location/platform-location-app.class';
import {GetDescendantsOfPlatformFail} from './errors/GetDecendantsOfPlatformFail';
import * as Promise from 'bluebird';
import {CutDescendantsOfPlatformFail} from './errors/CutDescendantsOfPlatformFail';
import * as joi from '@hapi/joi';
import {PlatformAlreadyUnhosted} from './errors/PlatformAlreadyUnhosted';
import * as logger from 'node-logger';


export async function createPlatform(platform: PlatformApp): Promise<PlatformApp> {

  const platformDb = platformAppToDb(platform);

  let createdPlatform;
  try {
    createdPlatform = await Platform.create(platformDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new PlatformAlreadyExists(`A platform with an id of ${platform.id} already exists.`);
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
    foundPlatform = await Platform.findById(id).exec();
  } catch (err) {
    throw new GetPlatformFail(undefined, err.message);
  }

  if (!foundPlatform) {
    throw new PlatformNotFound(`A platform with id '${id}' could not be found`);
  }

  return platformDbToApp(foundPlatform);

}


export async function getPlatforms(where: {inDeployment?: string}): Promise<PlatformApp[]> {

  const findWhere: any = {
    deletedAt: {$exists: false}
  };
  if (check.assigned(where.inDeployment)) {
    findWhere.inDeployments = where.inDeployment; 
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
  description: joi.string(),
  static: joi.boolean()  
});

export async function updatePlatform(id, updates: {name: string; description: string; static: boolean}): Promise<PlatformApp> {

  joi.attempt(updates, updatesSchema); // throws error if invalid

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
    throw new UpdatePlatformFail(undefined, err.message);
  }

  if (!updatedPlatform) {
    throw new PlatformNotFound(`A platform with id '${id}' could not be found`);
  }

  return platformDbToApp(updatedPlatform);  

}


// Not only does this update this platform, but if this platform has any descendents then their hostedByPath will be updated too.
// Also works if the platform isn't yet hosted.
export async function rehostPlatform(id: string, hostId?: string | null): Promise<{platform: PlatformApp; oldAncestors: string[]; newAnestors: string[]}> {

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
  const updates = {
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
    deletedPlatform = await Platform.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
      }
    ).exec();
  } catch (err) {
    throw new DeletePlatformFail(`Failed to delete Platform '${id}'`, err.message);
  }

  if (!deletedPlatform) {
    throw new PlatformNotFound(`A platform with id '${id}' could not be found`);
  }

  return;

}



export async function getdescendantsOfPlatform(id): Promise<PlatformApp[]> {

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



export async function cutDescendantsOfPlatform(id: string): Promise<void> {

  const descendants = await getdescendantsOfPlatform(id);

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



export function mergePlatformsWithPlatformLocations(platforms: PlatformApp[], platformLocations: PlatformLocationApp[]): PlatformApp[] {
  const merged = platforms.map((platform) => {
    const matchingPlatformLocation = platformLocations.find((platformLocation) => platformLocation.platform === platform.id);
    if (matchingPlatformLocation) {
      return Object.assign({}, platform, {location: matchingPlatformLocation.location});
    } else {
      return Object.assign({}, platform);
    }
  });
  return merged;
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
  return platformApp;
}


export function platformAppToClient(platformApp: PlatformApp): PlatformClient {
  const platformClient: any = cloneDeep(platformApp);
  return platformClient;
} 


export function platformClientToApp(platformClient: PlatformClient): PlatformApp {
  const platformApp: any = cloneDeep(platformClient);
  return platformApp; 
}