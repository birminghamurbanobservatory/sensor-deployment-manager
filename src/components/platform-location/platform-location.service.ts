import {PlatformLocationApp} from './platform-location-app.class';
import PlatformLocation from './platform-location.model';
import {CreatePlatformLocationFail} from './errors/CreatePlatformLocationFail';
import {GetPlatformLocationFail} from './errors/GetPlatformLocationFail';
import {GetPlatformLocationsFail} from './errors/GetPlatformLocationsFail';
import {PlatformLocationNotFound} from './errors/PlatformLocationNotFound';
import {InvalidPlatformLocation} from './errors/InvalidPlatformLocation';
import {validateGeometry} from '../../utils/geojson-validator';
import {knex} from '../../db/knex';
import {convertKeysToSnakeCase, convertKeysToCamelCase} from '../../utils/class-converters';
import {PlatformLocationClient} from './platform-location-client';


export async function createPlatformLocationsTable(): Promise<void> {

  await knex.schema.createTable('platform_locations', (table): void => {

    table.specificType('id', 'BIGSERIAL'); // Don't set this as primary or else create_hypertable won't work.
    table.string('platform').notNullable();
    table.timestamp('date', {useTz: true}).notNullable();
    table.specificType('geo', 'GEOGRAPHY').notNullable();
    table.jsonb('geojson').notNullable();
    table.string('location_id').notNullable(); // e.g. client-2019-09..., or gps-abc-2019-08..., or inherited-2019-04..., this gives us a way of updating all instances, e.g. if a user realised they'd incorrected located a platform.

  });

  // Create the hypertable
  await knex.raw(`SELECT create_hypertable('platform_locations', 'date');`);
  // TODO: Should I delete the default index that the line above will create?
  await knex.raw('CREATE UNIQUE INDEX ON platform_locations (platform, date DESC)');
  await knex.raw('CREATE INDEX location_index ON platform_locations USING GIST (geo);');

  return;
}



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
    const result = await knex('platform_locations')
    .insert(platformLocationDb)
    .returning('*');
    createdPlatformLocation = result[0];
  } catch (err) {
    throw new CreatePlatformLocationFail(undefined, err.message);
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
  const platformLocationDb = convertKeysToSnakeCase(platformLocationApp);
  platformLocationDb.geo = knex.raw(`ST_GeomFromGeoJSON('${JSON.stringify(platformLocationDb.location)}')::geography`);
  platformLocationDb.geojson = platformLocationDb.location;
  delete platformLocationDb.location;
  return platformLocationDb;
}


function platformLocationDbToApp(platformLocationDb: any): PlatformLocationApp {
  const platformLocationApp = convertKeysToCamelCase(platformLocationDb);
  platformLocationApp.location = platformLocationDb.geojson;
  delete platformLocationApp.geojson;
  delete platformLocationApp.geo;
  // TODO: Do I need to do any conversion of the location to GEOJSON?
  return platformLocationApp;
}


export function platformLocationAppToClient(platformLocationApp: PlatformLocationApp): PlatformLocationClient {

  const platformLocationClient = Object.assign(
    {}, 
    {
      id: platformLocationApp.locationId,
      date: platformLocationApp.date,
    },
    platformLocationApp.location
  ); 

  return platformLocationClient;

}