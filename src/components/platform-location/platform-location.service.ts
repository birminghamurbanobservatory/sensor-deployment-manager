import {PlatformLocationApp} from './platform-location-app.class';
import {cloneDeep} from 'lodash';
import PlatformLocation from './platform-location.model';
import {CreatePlatformLocationFail} from './errors/CreatePlatformLocationFail';
import {GetPlatformLocationFail} from './errors/GetPlatformLocationFail';
import {GetPlatformLocationsFail} from './errors/GetPlatformLocationsFail';
import {PlatformLocationNotFound} from './errors/PlatformLocationNotFound';
import {InvalidPlatformLocation} from './errors/InvalidPlatformLocation';
import {validateGeometry} from '../../utils/geojson-validator';


// ----TODO--- Use a timescaledb datebase instead (with POSTGIS and geojson).


export async function createPlatformLocation(platformLocation: PlatformLocationApp): Promise<PlatformLocationApp> {

  // Let's check that the geojson is valid here as it's a little tricky to do this in the mongoose model schema.
  try {
    validateGeometry(platformLocation.location);
  } catch (err) {
    throw new InvalidPlatformLocation(`Invalid location object. Reason: ${err.message}`);
  }

  const platformLocationDb = platformLocationAppToDb(platformLocation);

  let createdPlatformLocation;
  try {
    createdPlatformLocation = await PlatformLocation.create(platformLocationDb);
  } catch (err) {
    if (err.name === 'ValidationError') {
      throw new InvalidPlatformLocation(err.message);
    } else {
      throw new CreatePlatformLocationFail(undefined, err.message);
    }    
  }

  return platformLocationDbToApp(createdPlatformLocation);

}


export async function getCurrentPlatformLocation(platformId: string): Promise<PlatformLocationApp> {

  let foundPlatformLocation;
  try {
    foundPlatformLocation = await PlatformLocation.findOne({
      platform: platformId,
      endDate: {$exists: false}
    }).exec();
  } catch (err) {
    throw new GetPlatformLocationFail(undefined, err.message);
  }

  if (!foundPlatformLocation) {
    throw new PlatformLocationNotFound(`A current location could not be found for the platform with id '${platformId}'.`);
  }

  return platformLocationDbToApp(foundPlatformLocation);

}


export async function getCurrentPlatformLocations(platformIds: string[]): Promise<PlatformLocationApp[]> {

  let foundPlatformLocations;
  try {
    foundPlatformLocations = await PlatformLocation.find({
      platform: {$in: platformIds},
      endDate: {$exists: false}
    }).exec();
  } catch (err) {
    throw new GetPlatformLocationsFail(undefined, err.message);
  }

  return foundPlatformLocations.map(platformLocationDbToApp);

}



function platformLocationAppToDb(platformLocationApp: PlatformLocationApp): object {
  const platformLocationDb: any = cloneDeep(platformLocationApp);
  platformLocationDb._id = platformLocationApp.id;
  return platformLocationDb;
}


function platformLocationDbToApp(platformLocationDb: any): PlatformLocationApp {
  const platformLocationApp = platformLocationDb.toObject();
  platformLocationApp.id = platformLocationApp._id.toString();
  delete platformLocationApp._id;
  delete platformLocationApp.__v;  
  return platformLocationApp;
}