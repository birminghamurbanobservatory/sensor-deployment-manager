import Platform from './platform.model';
import {PlatformApp} from './platform-app.class';
import {PlatformClient} from './platform-client.class';
import {cloneDeep} from 'lodash';
import {PlatformAlreadyExists} from './errors/PlatformAlreadyExists';
import {InvalidPlatform} from './errors/InvalidPlatform';
import {CreatePlatformFail} from './errors/CreatePlatformFail';
import {GetPlatformFail} from './errors/GetPlatformFail';
import {PlatformNotFound} from './errors/PlatformNotFound';
import {GetPlatformsFail} from './errors/GetPlatformsFail';
import * as check from 'check-types';
import {PlatformLocationApp} from '../platform-location/platform-location-app.class';



export async function createPlatform(platform: PlatformApp): Promise<PlatformApp> {

  const platformDb = platformAppToDb(platform);

  let createdPlatform;
  try {
    createdPlatform = await Platform.create(platformDb);
  } catch (err) {
    console.log(err);
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

  const findWhere: any = {};
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
  platformApp.id = platformApp._id;
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