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
import {DeleteSensorFail} from './errors/DeleteSensorFail';



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
    sensor = await Sensor.findOne({
      _id: id,
      deletedAt: {$exists: false}
    }).exec();
  } catch (err) {
    throw new GetSensorFail(undefined, err.message);
  }

  if (!sensor) {
    throw new SensorNotFound(`A sensor with id '${id}' could not be found.`);
  }

  return sensorDbToApp(sensor);

}



export async function getSensors(where: {isHostedBy?: any; permanentHost?: any; inDeployment?: any}): Promise<SensorApp[]> {

  // TODO: Might we worth having some validation on the where object here?

  const findWhere = Object.assign(
    {}, 
    whereToMongoFind(where), 
    {
      deletedAt: {$exists: false}
    }
  );

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
    await Sensor.findOneAndUpdate(
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
    throw new RemoveSensorFromPlatformFail(undefined, err.message);
  }

  return;
}


export async function removeSensorFromDeployment(id: string): Promise<void> {

  try {
    // Because the platform belongs to the deployment we'll need to remove it from the platform too.
    const updates = {$unset: {isHostedBy: '', inDeployment: ''}};
    await Sensor.findOneAndUpdate(
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

  // N.B. for simplicity we won't let users update individual objects in the initialConfig or currentConfig arrays. Theyt'll have to update the whole thing in one go. 

  // If there's any properties such as inDeployment or isHostedBy that you want to remove completely, e.g. because a sensor has been removed from a deployment then pass in a value of null to have the property unset, e.g. {inDeployment: null}.
  const modifiedUpdates = replaceNullUpdatesWithUnset(updates);

  let updatedSensor;
  try {
    updatedSensor = await Sensor.findOneAndUpdate(
      {
        _id: id,
        deletedAt: {$exists: false}
      },
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


// A soft delete
export async function deleteSensor(id: string): Promise<void> {

  const updates = {
    deletedAt: new Date(),
    $unset: {
      // Can always look at the context documents if you need to remember which deployment/platform this sensor was in/on.
      inDeployment: '',
      isHostedBy: '',
    }
  };

  let deletedSensor;
  try {
    deletedSensor = await Sensor.findOneAndUpdate(
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
    throw new DeleteSensorFail(`Failed to delete sensor '${id}'.`, err.message);
  }

  if (!deletedSensor) {
    throw new SensorNotFound(`A sensor with id '${id}' could not be found`);
  }

  return;

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
  sensorApp.initialConfig = sensorApp.initialConfig.map(renameId);
  sensorApp.currentConfig = sensorApp.currentConfig.map(renameId);
  return sensorApp;
}


function renameId(doc): any {
  if (doc._id) {
    doc.id = doc._id;
    delete doc._id;
  }
  return doc;
}


export function sensorAppToClient(sensorApp: SensorApp): SensorClient {
  const sensorClient: any = cloneDeep(sensorApp);
  sensorClient.createdAt = sensorClient.createdAt.toISOString();
  sensorClient.updatedAt = sensorClient.updatedAt.toISOString();
  return sensorClient;
} 


export function sensorClientToApp(sensorClient: SensorClient): SensorApp {
  const sensorApp: any = cloneDeep(sensorClient);
  return sensorApp; 
}