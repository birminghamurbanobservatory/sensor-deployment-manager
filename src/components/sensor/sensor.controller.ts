import {SensorClient} from './sensor-client.class';
import {SensorApp} from './sensor-app.class';
import * as logger from 'node-logger';
import * as sensorService from './sensor.service';
import * as platformService from '../platform/platform.service';
import * as deploymentService from '../deployment/deployment.service';
import * as permanentHostService from '../permanent-host/permanent-host.service';
import * as contextService from '../context/context.service';
import {ContextApp} from '../context/context-app.class';
import * as joi from '@hapi/joi';
import {InvalidSensor} from './errors/InvalidSensor';
import * as check from 'check-types';
import {BadRequest} from '../../errors/BadRequest';
import {CannotHostSensorWithPermanentHost} from './errors/CannotHostSensorWithPermanentHost';
import {PlatformApp} from '../platform/platform-app.class';
import {DeploymentApp} from '../deployment/deployment-app.class';
import {concat} from 'lodash';
import {CannotUnhostSensorWithPermanentHost} from './errors/CannotUnhostSensorWithPermanentHost';
import {generateSensorId, prefixForGeneratedIds} from '../../utils/generate-sensor-id';


const newSensorSchema = joi.object({
  id: joi.string(), // we'll leave the model schema to check the length
  name: joi.string(),
  description: joi.string(),
  permanentHost: joi.string(),
  inDeployment: joi.string(),
  // N.B. isHostedBy is not allow here. Hosting a sensor on a platform is a separate step and depends on whether the sensor has a permanentHost or not. 
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
.xor('permanentHost', 'inDeployment') 
// Either a sensor has a permanentHost and is therefore added to a deployment via a registration key OR a standalone sensor must be created already in a deployment.
.without('inDeployment', 'id')
// When a sensor is being added directly to a deployment, then don't allow the user to set the id themselves, this is to avoid clashes with more readable IDs that superusers assign to sensors on permanentHosts.
.required();


export async function createSensor(sensor: SensorClient): Promise<SensorClient> {

  logger.debug('Creating new sensor');

  // Well worth having some validation here to ensure the code below works ok.
  const {error: err} = newSensorSchema.validate(sensor);
  if (err) {
    throw new InvalidSensor(err.message);
  }

  // If the sensor has an id, then check it doesn't start with the prefix we'll use for sensors assigned straight to a deployment.
  if (sensor.id) {
    const firstPart = sensor.id.split('-')[0];
    if (firstPart === prefixForGeneratedIds) {
      throw new InvalidSensor(`Sensor ID cannot start with '${firstPart}-'`);
    }
  }

  // If the sensor doesn't have an id then assign one
  if (!sensor.id) {
    sensor.id = generateSensorId(sensor.name);
  } 

  // Begin to create the context for this sensor.
  const context: ContextApp = {
    sensor: sensor.id,
    startDate: new Date(),
    toAdd: {}
  };

  // Is the sensor being created already in a deployment
  if (sensor.inDeployment) {
    context.toAdd.inDeployments = [sensor.inDeployment];
  }

  // Have any defaults been set for the sensor that should be used in the context.
  if (sensor.defaults) {
    context.toAdd = sensor.defaults;
  }

  // Check the permanent host exists if provided
  if (sensor.permanentHost) {
    await permanentHostService.getPermanentHost(sensor.permanentHost);
  }

  const sensorToCreate: SensorApp = sensorService.sensorClientToApp(sensor);
  const createdSensor: SensorApp = await sensorService.createSensor(sensorToCreate);
  logger.debug('New sensor created', createdSensor);

  const createdContext = await contextService.createContext(context);
  logger.debug('Context created for new sensor', createdContext);

  return sensorService.sensorAppToClient(createdSensor);

}



export async function getSensor(id: string): Promise<SensorClient> {

  const sensor: SensorApp = await sensorService.getSensor(id);
  logger.debug('Sensor found', sensor);
  return sensorService.sensorAppToClient(sensor);

}


export async function getSensors(where: any): Promise<SensorClient[]> {

  const sensors: SensorApp[] = await sensorService.getSensors(where);
  logger.debug('Sensors found', sensors);
  return sensors.map(sensorService.sensorAppToClient);

}



const sensorUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  name: joi.string(),
  description: joi.string(),
  permanentHost: joi.string().allow(null),
  defaults: joi.object({})
    .allow(null)
    .unknown()  
})
.min(1)
.required(); 

// When it comes to adding/removing sensors to platforms and deployments, this is handled elsewhere, e.g. via registration keys.
export async function updateSensor(id: string, updates: any): Promise<SensorClient> {

  logger.debug(`Updating sensor '${id}'`);

  // First let's get the current sensor details
  const oldSensor = await sensorService.getSensor(id);

  const {error: validationErr} = sensorUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  const permanentHostChange = check.containsKey(updates, 'permanentHost') && 
    oldSensor.permanentHost !== updates.permanentHost &&
    !(!oldSensor.permanentHost && updates.permanentHost === null);

  const defaultsChange = check.containsKey(updates, 'defaultsChange');

  // Only allow the user to update the permanentHost when the sensor is currently unassigned to a deployment or platform.
  if (permanentHostChange && (oldSensor.inDeployment)) {
    throw new BadRequest(`The sensor is still in the '${oldSensor.inDeployment}' deployment. Please remove it from this deployment before changing the permanent host`);
  }
  if (permanentHostChange && (oldSensor.isHostedBy)) {
    throw new BadRequest(`The sensor is still hosted by the '${oldSensor.isHostedBy}' platform. Please remove it from this platform before changing the permanent host`);
  }

  if (updates.permanentHost) {
    // Check this permanent host exists
    await permanentHostService.getPermanentHost(updates.permanentHost);
  }

  const updatedSensor = await sensorService.updateSensor(id, updates);
  logger.debug(`Sensor '${id}' updated.`);

  // If the sensor isn't in a deployment then changes to its defaults should also update its context
  if (!oldSensor.inDeployment && defaultsChange) {

    logger.debug(`Context for sensor ${id} needs updating.`);
    
    // End current context
    const transitionDate = new Date();
    await contextService.endLiveContextForSensor(id, transitionDate);
    
    // Create new context
    const newContext: ContextApp = {
      sensor: id,
      startDate: transitionDate,
      toAdd: updatedSensor.defaults || {}
    };

    // Create the new context
    const createdContext = await contextService.createContext(newContext);
    logger.debug(`New context for sensor ${id}.`, createdContext);

  }

  return sensorService.sensorAppToClient(updatedSensor);

}



// IMPORTANT: This is not the procedure by which sensors on permanentHosts are hosted on a platfrom. This is done via a registration key.
export async function hostSensorOnPlatform(sensorId: string, platformId: string): Promise<SensorClient> {

  // First let's get the sensor
  const sensor: SensorApp = await sensorService.getSensor(sensorId);

  // Check this sensor doesn't have a permanentHost
  if (sensor.permanentHost) {
    throw new CannotHostSensorWithPermanentHost(`Sensor '${sensorId}' has a permanent host (i.e. is physically attached to this host) and thus it cannot be directly hosted on another platform using this method.`);
  }

  // Throws error if the platform does not exist
  const platform: PlatformApp = await platformService.getPlatform(platformId);

  // Check it's ok to add the sensor to this platform
  let hasAccessToPlatform;
  if (platform.inDeployments.includes(sensor.inDeployment)) {
    hasAccessToPlatform = true;
  } else {
    // Is the platform's owner deployment public?
    const platformDeployment: DeploymentApp = await deploymentService.getDeployment(platform.ownerDeployment);
    if (platformDeployment.public) {
      hasAccessToPlatform = true;
    }
  }
  if (!hasAccessToPlatform) {
    throw new InvalidSensor(`Platform '${platformId} is either not associated with the '${sensor.inDeployment}' deployment, or it is in a private deployment. Therefore sensor '${sensorId}' cannot be hosted on it.`);
  }

  // Update the sensor
  const updatedSensor = await sensorService.updateSensor(sensorId, {
    isHostedBy: platformId
  });

  // Now to update its context
  let newHostedByPath = [platformId];
  if (platform.hostedByPath) {
    newHostedByPath = concat(platform.hostedByPath, newHostedByPath);
  }
  await contextService.changeSensorsHostedByPath(sensorId, newHostedByPath);

  return sensorService.sensorAppToClient(updatedSensor);

}



export async function unhostSensorFromPlatform(sensorId: string): Promise<SensorClient> {
  

  // First let's get the sensor
  const sensor: SensorApp = await sensorService.getSensor(sensorId);

  // Check this sensor doesn't have a permanentHost
  if (sensor.permanentHost) {
    throw new CannotUnhostSensorWithPermanentHost(`Sensor '${sensorId}' has a permanent host (i.e. is physically attached to this host) and thus it cannot be unhosted.`);
  }

  // Update the sensor
  const updatedSensor = await sensorService.updateSensor(sensorId, {
    isHostedBy: null
  });

  // Now to update its context
  await contextService.removeSensorsHostedByPath(sensorId);

  return sensorService.sensorAppToClient(updatedSensor);  

}


