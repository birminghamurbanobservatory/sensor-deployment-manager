import UnknownSensor from './unknown-sensor.model';
import {UnknownSensorApp} from './unknown-sensor-app.class';
import {cloneDeep} from 'lodash';
import {UnknownSensorClient} from './unknown-sensor-client.class';
import {UpsertUnknownSensorFail} from './errors/UpsertUnknownSensorFail';
import {GetUnknownSensorsFail} from './errors/GetUnknownSensorsFail';
import {UnknownSensorNotFound} from './errors/UnknownSensorNotFound';
import {DeleteUnknownSensorFail} from './errors/DeleteUnknownSensorFail';


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


export async function getUnknownSensors(): Promise<UnknownSensorApp[]> {

  let unknownSensors;
  try {
    unknownSensors = await UnknownSensor.find({}).exec();
  } catch (err) {
    throw new GetUnknownSensorsFail(undefined, err.message);
  }

  return unknownSensors.map(unknownSensorDbToApp);  

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
  const unknownSensorApp = unknownSensorDb.toObject();
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

