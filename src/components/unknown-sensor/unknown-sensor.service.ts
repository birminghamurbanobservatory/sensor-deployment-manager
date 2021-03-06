import UnknownSensor from './unknown-sensor.model';
import {UnknownSensorApp} from './unknown-sensor-app.class';
import {cloneDeep} from 'lodash';
import {UnknownSensorClient} from './unknown-sensor-client.class';
import {UpsertUnknownSensorFail} from './errors/UpsertUnknownSensorFail';
import {GetUnknownSensorsFail} from './errors/GetUnknownSensorsFail';
import {UnknownSensorNotFound} from './errors/UnknownSensorNotFound';
import {DeleteUnknownSensorFail} from './errors/DeleteUnknownSensorFail';
import {PaginationOptions} from '../common/pagination-options.interface';
import * as check from 'check-types';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';


export async function upsertUnknownSensor(unknownSensor: UnknownSensorApp): Promise<UnknownSensorApp> {

  const unknownSensorDb: any = unknownSensorAppToDb(unknownSensor);
  // Make sure the nObservations field increments
  unknownSensorDb.$inc = {nObservations: 1};

  let upsertedUnknownSensor;
  try {
    upsertedUnknownSensor = await UnknownSensor.findOneAndUpdate(
      {
        _id: unknownSensorDb._id
      },
      unknownSensorDb,
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new UpsertUnknownSensorFail(undefined, err.message);
  }

  return unknownSensorDbToApp(upsertedUnknownSensor);

}


export async function getUnknownSensors(where = {}, options: PaginationOptions = {}): Promise<{data: UnknownSensorApp[]; count: number; total: number}> {

  const findWhere = whereToMongoFind(where);

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);

  let unknownSensors;
  try {
    unknownSensors = await UnknownSensor.find(findWhere, null, findOptions); 
  } catch (err) {
    throw new GetUnknownSensorsFail(undefined, err.message);
  }

  const count = unknownSensors.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await UnknownSensor.countDocuments(where);
    }
  } else {
    total = count;
  }

  const unknownSensorsForApp = unknownSensors.map(unknownSensorDbToApp);

  return {
    data: unknownSensorsForApp,
    count,
    total
  };

}


export async function deleteUnknownSensor(sensorId: string): Promise<void> {

  let deletedUnknownSensor;
  try {
    deletedUnknownSensor = await UnknownSensor.findOneAndDelete({
      _id: sensorId
    }).exec();
  } catch (err) {
    throw new DeleteUnknownSensorFail(`Failed to delete unknown sensor '${sensorId}'`, err.message);
  }

  if (!deletedUnknownSensor) {
    throw new UnknownSensorNotFound(`Failed to find an unknown sensor with id '${sensorId}' to delete.`);
  }

  return;

}



function unknownSensorAppToDb(unknownSensorApp: UnknownSensorApp): object {
  const unknownSensorDb: any = cloneDeep(unknownSensorApp);
  unknownSensorDb._id = unknownSensorApp.id;
  delete unknownSensorDb.id;
  return unknownSensorDb;
}


function unknownSensorDbToApp(unknownSensorDb: any): UnknownSensorApp {
  let unknownSensorApp = cloneDeep(unknownSensorDb);
  if (unknownSensorApp.toObject) {
    // Need this if statement, because .aggregate responses seem to be POJO
    unknownSensorApp = unknownSensorApp.toObject();
  }
  unknownSensorApp.id = unknownSensorApp._id.toString();
  delete unknownSensorApp._id;
  delete unknownSensorApp.__v;
  return unknownSensorApp;
}


export function unknownSensorAppToClient(sensorApp: UnknownSensorApp): UnknownSensorClient {
  const unknownSensorClient: any = cloneDeep(sensorApp);
  unknownSensorClient.createdAt = unknownSensorClient.createdAt.toISOString();
  unknownSensorClient.updatedAt = unknownSensorClient.updatedAt.toISOString();
  return unknownSensorClient;
} 

