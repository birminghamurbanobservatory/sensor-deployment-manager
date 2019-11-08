import * as Promise from 'bluebird';
import Sensor from './sensor.model';
import {SensorApp} from './sensor-app.class';
import * as check from 'check-types';
import {GetSensorsFail} from './errors/GetSensorsFail';
import {GetSensorFail} from './errors/GetSensorFail';
import {SensorNotFound} from './errors/SensorNotFound';
import {SensorClient} from './sensor-client.class';
import {cloneDeep} from 'lodash';
import {RemoveSensorFromPlatformFail} from './errors/RemoveSensorFromPlatformFail';
import {RemoveSensorFromDeploymentFail} from './errors/RemoveSensorFromDeploymentFail';


export async function getSensor(id): Promise<SensorApp> {

  let sensor;
  try {
    sensor = await Sensor.findById(id).exec();
  } catch (err) {
    throw new GetSensorFail(undefined, err.message);
  }

  if (!sensor) {
    throw new SensorNotFound(`A sensor with id '${id}' could not be found.`);
  }

  return sensorDbToApp(sensor);

}


export async function getSensors(where: {isHostedBy?: string; permanentHost?: string; inDeployment?: string}): Promise<SensorApp[]> {

  const findWhere: any = Object.assign({}, where);

  let sensors;
  try {
    sensors = await Sensor.find(findWhere).exec();
  } catch (err) {
    throw new GetSensorsFail(undefined, err.message);
  }

  return sensors.map(sensorDbToApp);

}


export async function removeSensorFromPlatform(id: string): Promise<void> {

  try {
    const updates = {$unset: {isHostedBy: ''}};
    await Sensor.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new RemoveSensorFromPlatformFail(undefined, err.message);
  }

  return;
}


export async function removeSensorFromDeployment(id: string): Promise<void> {

  try {
    // Because the platform belongs to the deployment we'll need to remove it from the platform too.
    const updates = {$unset: {isHostedBy: '', inDeployment: ''}};
    await Sensor.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new RemoveSensorFromDeploymentFail(undefined, err.message);
  }

  return;
}



function sensorAppToDb(sensorApp: SensorApp): object {
  const sensorDb: any = cloneDeep(sensorApp);
  sensorDb._id = sensorApp.id;
  delete sensorDb.id;
  return sensorDb;
}


function sensorDbToApp(sensorDb: any): SensorApp {
  const sensorApp = sensorDb.toObject();
  sensorApp.id = sensorApp._id;
  delete sensorApp._id;
  delete sensorApp.__v;
  return sensorApp;
}


export function sensorAppToClient(sensorApp: SensorApp): SensorClient {
  const sensorClient: any = cloneDeep(sensorApp);
  return sensorClient;
} 


export function sensorClientToApp(sensorClient: SensorClient): SensorApp {
  const sensorApp: any = cloneDeep(sensorClient);
  return sensorApp; 
}