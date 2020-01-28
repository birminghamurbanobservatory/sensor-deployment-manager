import * as Promise from 'bluebird';
import Sensor from './sensor.model';
import {SensorApp} from './sensor-app.class';
import {GetSensorsFail} from './errors/GetSensorsFail';
import {GetSensorFail} from './errors/GetSensorFail';
import {SensorNotFound} from './errors/SensorNotFound';
import {SensorClient} from './sensor-client.class';
import {cloneDeep} from 'lodash';
import {RemoveSensorFromPlatformFail} from './errors/RemoveSensorFromPlatformFail';
import {RemoveSensorFromDeploymentFail} from './errors/RemoveSensorFromDeploymentFail';
import {RemoveSensorsFromDeploymentFail} from './errors/RemoveSensorsFromDeploymentFail';
import {SensorAlreadyExists} from './errors/SensorAlreadyExists';
import {CreateSensorFail} from './errors/CreateSensorFail';
import {InvalidSensor} from './errors/InvalidSensor';
import {UpdateSensorFail} from './errors/UpdateSensorFail';
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {UnhostExternalSensorsFromDisappearingDeploymentFail} from './errors/UnhostExternalSensorsFromDisappearingDeploymentFail';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';



export async function createSensor(sensor: SensorApp): Promise<SensorApp> {

  const sensorDb = sensorAppToDb(sensor);

  let createdSensor;
  try {
    createdSensor = await Sensor.create(sensorDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new SensorAlreadyExists(`A sensor with an id of '${sensor.id}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidSensor(err.message);
    } else {
      throw new CreateSensorFail(undefined, err.message);
    }
  }

  return sensorDbToApp(createdSensor);

}



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

// TODO: If you start soft deleting sensors then you'll want to actively exclude sensors that have been soft deleted from many of these queries.


export async function getSensors(where: {isHostedBy?: any; permanentHost?: any; inDeployment?: any}): Promise<SensorApp[]> {

  // TODO: Might we worth having some validation on the where object here?

  const findWhere = whereToMongoFind(where);

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


export async function removeSensorsFromDeployment(deploymentId: string): Promise<void> {

  try {
    // Because the platform belongs to the deployment we'll need to remove it from the platform too.
    const updates = {$unset: {isHostedBy: '', inDeployment: ''}};
    await Sensor.updateMany(
      {
        inDeployment: deploymentId
      },
      updates
    ).exec();
  } catch (err) {
    throw new RemoveSensorsFromDeploymentFail(undefined, err.message);
  }

  return;
}



export async function updateSensor(id: string, updates: any): Promise<SensorApp> {

  // N.B. for simplicity we won't let users update individual properties of the defaults object, if they want to update the defaults they have to provide all the defaults they want everytime.

  // If there's any properties such as inDeployment or isHostedBy that you want to remove completely, e.g. because a sensor has been removed from a deployment then pass in a value of null to have the property unset, e.g. {inDeployment: null}.
  const modifiedUpdates = replaceNullUpdatesWithUnset(updates);

  let updatedSensor;
  try {
    updatedSensor = await Sensor.findByIdAndUpdate(
      id,
      modifiedUpdates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new UpdateSensorFail(undefined, err.message);
  }

  if (!updatedSensor) {
    throw new SensorNotFound(`A sensor with id '${id}' could not be found`);
  }

  return sensorDbToApp(updatedSensor);

}


// Handy when a deployment is made private or deleted.
export async function unhostExternalSensorsFromDisappearingDeployment(deploymentId, deploymentPlatformIds): Promise<void> {

  try {
    await Sensor.updateMany(
      {
        inDeployment: {$ne: deploymentId},
        isHostedBy: {$in: deploymentPlatformIds}
      },
      {
        $unset: {isHostedBy: ''}
      }
    ).exec();
  } catch (err) {
    throw new UnhostExternalSensorsFromDisappearingDeploymentFail(undefined, err.message);
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
  sensorApp.id = sensorApp._id.toString();
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