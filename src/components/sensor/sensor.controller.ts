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
import {CannotHostSensorOnPermanentHost} from './errors/CannotHostSensorOnPermanentHost';
import {deleteUnknownSensor} from '../unknown-sensor/unknown-sensor.service';


const defaultSchema = joi.object({
  observedProperty: joi.string(),
  hasFeatureOfInterest: joi.string(),
  usedProcedures: joi.array().items(joi.string()),
  when: joi.array().items(joi.object({
    observedProperty: joi.string(),
    hasFeatureOfInterest: joi.string(),
    usedProcedures: joi.array().items(joi.string()),
  }))
});

const newSensorSchema = joi.object({
  id: joi.string(), // we'll leave the model schema to check the length
  name: joi.string(),
  description: joi.string(),
  permanentHost: joi.string(),
  inDeployment: joi.string(),
  // N.B. isHostedBy is not allow here. Hosting a sensor on a platform is a separate step and depends on whether the sensor has a permanentHost or not. 
  defaults: joi.array().items(defaultSchema)
})
.or('id', 'inDeployment')
// If an ID isn't provided, then inDeployment must be, as this indicates that a deployment sensor is being created.
.without('inDeployment', 'permanentHost')
// I don't want inDeployment and permanentHost to be set at the same time. Is the sensor has a permanentHost then the mechanism for adding the sensor to a deployment is via a registration key.
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
  };

  // Check the deployment exists if provided
  if (sensor.inDeployment) {
    await deploymentService.getDeployment(sensor.inDeployment);
  }

  // Is the sensor being created already in a deployment
  if (sensor.inDeployment) {
    context.inDeployments = [sensor.inDeployment];
  }

  // Have any defaults been set for the sensor that should be used in the context.
  context.defaults = sensor.defaults || [];

  // Check the permanent host exists if provided
  if (sensor.permanentHost) {
    await permanentHostService.getPermanentHost(sensor.permanentHost);
  }

  const sensorToCreate: SensorApp = sensorService.sensorClientToApp(sensor);
  const createdSensor: SensorApp = await sensorService.createSensor(sensorToCreate);
  logger.debug('New sensor created', createdSensor);

  const createdContext = await contextService.createContext(context);
  logger.debug('Context created for new sensor', createdContext);

  // If there's a corresponding Unknown Sensor document for this sensor then delete it as the sensor is no longer unknown.
  try {
    await deleteUnknownSensor(createdSensor.id);
  } catch (err) {
    if (err.name === 'UnknownSensorNotFound') {
      // This is fine, it just means there's been no observations from this sensor yet.
    } else {
      throw err;
    }
  }

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
  inDeployment: joi.string().allow(null),
  permanentHost: joi.string().allow(null),
  defaults: joi.array().items(defaultSchema).allow(null) 
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

  // If the sensor will have a permanentHost, then inDeployment cannot be set here, the mechanism for adding the sensor to the deployment would be via the registrationKey of the permanentHost
  if ((updates.permanentHost || (oldSensor.permanentHost && updates.permanentHost !== null)) && updates.inDeployment) {
    throw new BadRequest(`It is not possible to set 'inDeployment' when the sensor will have a permanent host.`);
  }

  const permanentHostChange = check.containsKey(updates, 'permanentHost') && 
    oldSensor.permanentHost !== updates.permanentHost &&
    !(!oldSensor.permanentHost && updates.permanentHost === null);

  const inDeploymentChange = check.containsKey(updates, 'inDeployment') && 
    oldSensor.inDeployment !== updates.inDeployment &&
    !(!oldSensor.inDeployment && updates.inDeployment === null);

  if (inDeploymentChange && oldSensor.isHostedBy) {
    throw new BadRequest(`The sensor is still hosted by the '${oldSensor.isHostedBy}' platform. You cannot change its deployment until the sensor is removed from this platform.`);
  }

  if (permanentHostChange && (oldSensor.isHostedBy)) {
    throw new BadRequest(`The sensor is still hosted by the '${oldSensor.isHostedBy}' platform. You cannot change the permanent host until the platform is removed from this platform.`);
  }

  // Only allow the user to set the permanentHost if the sensor won't be assigned to a deployment
  if (permanentHostChange && updates.permanentHost && oldSensor.inDeployment && updates.inDeployment !== null) {
    throw new BadRequest(`The sensor cannot be assigned a permanent host when it is, or will be, in a deployment.`);
  }

  let permanentHost;
  if (updates.permanentHost) {
    // Check this permanent host exists
    permanentHost = await permanentHostService.getPermanentHost(updates.permanentHost);
  }

  // If it's being removed from a permanent host, and the permanent host was using this sensor to update its location, then we'll need to update the permanent host too.
  if (check.null(updates.permamentHost) && permanentHost && permanentHost.updateLocationWithSensor === id) {
    await permanentHostService.updatePermanentHost(permanentHost.id, {updateLocationWithSensor: null});
  }

  const updatedSensor = await sensorService.updateSensor(id, updates);
  logger.debug(`Sensor '${id}' updated.`);

  let contextUpdateRequired;
  const transitionDate = new Date();
  const newContext: ContextApp = {
    sensor: id,
    startDate: transitionDate,
    defaults: updatedSensor.defaults
    // We don't need to worry about inheriting defaults from the previous context, because the only thing (other than changing the defaults), that would trigger a context change is changing the deployment, in which case we'd want to revert to the sensor defaults anyway.
    // Because inDeployment and permanentHost cannot be changed unless isHostedBy is unset, then we know that we don't need to add a isHostedBy property here.
  };

  // If the deployment has changed
  if (inDeploymentChange) {
    contextUpdateRequired = true;
    if (updates.inDeployment) {
      newContext.inDeployments = [updates.inDeployment];
    }
  }

  const defaultsChange = check.containsKey(updates, 'defaultsChange');
  if (defaultsChange) {
    contextUpdateRequired = true;
  }

  if (contextUpdateRequired) {

    logger.debug(`Context for sensor ${id} needs updating.`);

    // End current context
    const transitionDate = new Date();
    await contextService.endLiveContextForSensor(id, transitionDate);

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

  // If this platform is itself created from a permanentHost then don't allow more sensors to be hosted on it.
  if (platform.initialisedFrom) {
    throw new CannotHostSensorOnPermanentHost(`Platform '${platformId}' was generated from a permanent host and therefore it is not possible to add an extra sensor to it this way.`);
  }

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

  // TODO: might want to only run the following line for sensors that actually record location..
  await platformService.removeSensorFromAnyMatchingUpdateLocationWithSensor(sensorId);

  return sensorService.sensorAppToClient(updatedSensor);  

}


export async function deleteSensor(id: string): Promise<void> {

  await contextService.endLiveContextForSensor(id, new Date());
  await sensorService.deleteSensor(id);
  await platformService.removeSensorFromAnyMatchingUpdateLocationWithSensor(id);
  return;

}
