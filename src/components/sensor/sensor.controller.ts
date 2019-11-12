import {SensorClient} from './sensor-client.class';
import {SensorApp} from './sensor-app.class';
import * as logger from 'node-logger';
import * as sensorService from './sensor.service';
import * as deploymentService from '../deployment/deployment.service';
import * as platformService from '../platform/platform.service';
import * as permanentHostService from '../permanent-host/permanent-host.service';
import * as contextService from '../context/context.service';
import {ContextApp} from '../context/context-app.class';
import * as joi from '@hapi/joi';
import {InvalidSensor} from './errors/InvalidSensor';
import {PlatformApp} from '../platform/platform-app.class';
import * as check from 'check-types';
import {uniq, concat, merge} from 'lodash';


const newSensorSchema = joi.object({
  id: joi.string() // we'll leave the model schema to check the length
    .required(),
  name: joi.string(),
  description: joi.string(),
  inDeployment: joi.string(),
  permanentHost: joi.string(),
  isHostedBy: joi.string(),
  defaults: joi.object({
    observedProperty: joi.object({
      value: joi.string()
    }),
    hasFeatureOfInterest: joi.object({
      value: joi.string()
    }),
    usedProcedure: joi.object({
      value: joi.array().items(joi.string())
    })
  }) 
})
.with('permanentHost', 'inDeployment')
.required();


export async function createSensor(sensor: SensorClient): Promise<SensorClient> {

  // Well worth having some validation here to ensure the code below works ok.
  const {error: err} = newSensorSchema.validate(sensor);
  if (err) {
    throw new InvalidSensor(err.message);
  }

  // Begin to create the context for this sensor.
  const context: ContextApp = {
    sensor: sensor.id,
    startDate: new Date(),
    toAdd: {}
  };

  // Have any defaults been set for the sensor that should be used in the context.
  if (sensor.defaults) {
    context.toAdd = sensor.defaults;
  }

  // If the user is trying to add the sensor straight to a deployment on creation then check this deployment exists.
  if (sensor.inDeployment) {
    await deploymentService.getDeployment(sensor.inDeployment);
    context.toAdd.inDeployments = {value: [sensor.inDeployment]};
  }

  // Check the platform exists if provided
  if (sensor.isHostedBy) {
    const platform: PlatformApp = await platformService.getPlatform(sensor.isHostedBy);
    // Check this platform is in the deployment provided for the sensor
    if (!platform.inDeployments || !platform.inDeployments.includes(sensor.inDeployment)) {
      throw new InvalidSensor(`The platform '${sensor.isHostedBy}' provided via the isHostedBy property does not belong to the deployment '${sensor.inDeployment}' provided via the inDeployment field.`);
    }
    // If the platform belongs to extra deployments then add these to the context too.
    if (check.nonEmptyArray(platform.inDeployments)) {
      context.toAdd.inDeployments = {value: uniq(concat(sensor.inDeployment, platform.inDeployments))};
    } 
    // Set the hostedByPath for the context
    let hostedByPath = [platform.id];
    if (check.nonEmptyArray(platform.hostedByPath)) {
      hostedByPath = concat(platform.hostedByPath, hostedByPath);
    }
    context.toAdd.hostedByPath = {value: hostedByPath};
  }  

  // Check the permanent host exists if provided
  if (sensor.permanentHost) {
    await permanentHostService.getPermanentHost(sensor.permanentHost);
  }  

  await contextService.createContext(context);

  const sensorToCreate: SensorApp = sensorService.sensorClientToApp(sensor);
  const createdSensor: SensorApp = await sensorService.createSensor(sensorToCreate);  
  logger.debug('New sensor created', createdSensor);

  return sensorService.sensorAppToClient(createdSensor);

}



export async function updateSensor(id: string, updates: any): Promise<SensorClient> {

  const deploymentChange = check.containsKey(updates, 'inDeployment');
  const platformChange = check.containsKey(updates, 'isHostedBy');
  const permanentHostChange = check.containsKey(updates, 'permanentHost');
  const defaultsChange = check.containsKey(updates, 'defaultsChange');

  const transitionDate = new Date();

  if (updates.inDeployment) {
    // Check this deployment exists
    await deploymentService.getDeployment(updates.inDeployment);
  }

  if (updates.permanentHost) {
    // Check this permanent host exists
    await permanentHostService.getPermanentHost(updates.permanentHost);
  }

  let platform;
  if (updates.isHostedBy) {
    // Check this platform exists
    platform = await platformService.getPlatform(updates.isHostedBy);
  }

  // TODO: Need to check that if they have assigned the sensor to a new platform, that this platform belongs to the deployment that the sensor is in.

  const updatedSensor = await sensorService.updateSensor(id, updates);
  logger.debug(`Sensor '${id}' updated.`);

  // Many of the updates will end the current context and create a new context
  if (deploymentChange || platformChange || permanentHostChange || defaultsChange) {
    // End current context
    const endedContext = await contextService.endLiveContextForSensor(id, transitionDate);
    
    // Create new context
    const newContext: ContextApp = {
      sensor: id,
      startDate: transitionDate,
      toAdd: {}
    };

    // TODO: Changing a sensor's permanent host should also knock the sensor off its platform. And probably out of its deployment too.

    if (defaultsChange) {
      newContext.toAdd = updatedSensor.defaults;
    }

    if (!defaultsChange && deploymentChange && updatedSensor.defaults) {
      newContext.toAdd = updatedSensor.defaults;
    }

    if (!deploymentChange) {
      if (endedContext.toAdd.inDeployments) {
        newContext.toAdd.inDeployments = endedContext.toAdd.inDeployments;
      }
      if (endedContext.toAdd.hostedByPath) {
        newContext.toAdd.hostedByPath = endedContext.toAdd.hostedByPath;
      }
      if (!defaultsChange) {
        newContext.toAdd = endedContext.toAdd;
      }
    }

    if (platformChange) {
      if (updates.isHostedBy === null) {
        delete newContext.toAdd.hostedByPath;
      }
      if (platform) {
        let hostedByPath = [platform.id];
        if (check.nonEmptyArray(platform.hostedByPath)) {
          hostedByPath = concat(platform.hostedByPath, hostedByPath);
        }
        newContext.toAdd.hostedByPath = {value: hostedByPath};  
      }
    }

    // Create the new context
    await contextService.createContext(newContext);

  }

  return sensorService.sensorAppToClient(updatedSensor);

}
