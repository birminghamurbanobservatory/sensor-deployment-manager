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
import {concat, isEqual, cloneDeep} from 'lodash';
import {CannotUnhostSensorWithPermanentHost} from './errors/CannotUnhostSensorWithPermanentHost';
import {generateSensorId, prefixForGeneratedIds} from '../../utils/generate-sensor-id';
import {CannotHostSensorOnPermanentHost} from './errors/CannotHostSensorOnPermanentHost';
import {deleteUnknownSensor} from '../unknown-sensor/unknown-sensor.service';
import {PaginationOptions} from '../common/pagination-options.class';


const configSchema = joi.object({
  hasPriority: joi.boolean().required(),
  observedProperty: joi.string().required(),
  unit: joi.string(),
  hasFeatureOfInterest: joi.string(),
  disciplines: joi.array().items(joi.string()),
  usedProcedures: joi.array().items(joi.string())
});

const newSensorSchema = joi.object({
  id: joi.string(), // we'll leave the model schema to check the length
  name: joi.string(),
  description: joi.string(),
  permanentHost: joi.string(),
  hasDeployment: joi.string(),
  // N.B. isHostedBy is not allow here. Hosting a sensor on a platform is a separate step and depends on whether the sensor has a permanentHost or not. 
  initialConfig: joi.array().items(configSchema)
})
.or('id', 'hasDeployment')
// If an ID isn't provided, then hasDeployment must be, as this indicates that a deployment sensor is being created.
.without('hasDeployment', 'permanentHost')
// I don't want hasDeployment and permanentHost to be set at the same time. If the sensor has a permanentHost then the mechanism for adding the sensor to a deployment is via a registration key.
.required();


export async function createSensor(sensor: SensorClient): Promise<SensorClient> {

  logger.debug('Creating new sensor');

  // Well worth having some validation here to ensure the code below works ok.
  const {error: err} = newSensorSchema.validate(sensor);
  if (err) {
    throw new InvalidSensor(err.message);
  }

  // Make sure no more than 1 initialConfig object has hasPriority set to true.
  if (sensor.initialConfig) {
    const nTrue = sensor.initialConfig.reduce(configReduceFunction, 0);
    if (nTrue > 1) {
      throw new InvalidSensor(`More than one object in you initialConfig array has 'hasPriority: true'.`);
    }
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
  if (sensor.hasDeployment) {
    await deploymentService.getDeployment(sensor.hasDeployment);
  }

  // Is the sensor being created already in a deployment
  if (sensor.hasDeployment) {
    context.inDeployments = [sensor.hasDeployment];
  }

  // Has any config been set for the sensor that should be used in the context.
  context.config = sensor.initialConfig || [];

  // Check the permanent host exists if provided
  if (sensor.permanentHost) {
    await permanentHostService.getPermanentHost(sensor.permanentHost);
  }

  const sensorToCreate: SensorApp = sensorService.sensorClientToApp(sensor);
  // Use the initialConfig as the currentConfig.
  if (sensorToCreate.initialConfig) {
    sensorToCreate.currentConfig = sensorToCreate.initialConfig;
  }
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


const getSensorsWhereSchema = joi.object({
  id: joi.object({
    begins: joi.string(),
    in: joi.array().items(joi.string()).min(1)
  }),
  hasDeployment: joi.alternatives().try(
    joi.string(),
    joi.object({
      in: joi.array().items(joi.string()).min(1),
      exists: joi.boolean()
    }).min(1)
  ),
  isHostedBy: joi.alternatives().try(
    joi.string(),
    joi.object({
      in: joi.array().items(joi.string()).min(1),
      exists: joi.boolean()
    }).min(1)
  ),
  permanentHost: joi.alternatives().try(
    joi.string(),
    joi.object({
      exists: joi.boolean()
    }).min(1)
  ),
  search: joi.string()
});

export async function getSensors(where: any, options?: PaginationOptions): Promise<{data: SensorClient[]; meta: any}> {

  const {error: err, value: validWhere} = getSensorsWhereSchema.validate(where);
  if (err) throw new BadRequest(`Invalid 'where' object: ${err.message}`);

  const {data: sensors, count, total} = await sensorService.getSensors(validWhere, options);
  logger.debug(`${sensors.length} sensors found`);

  const sensorsForClient = sensors.map(sensorService.sensorAppToClient);
  
  return {
    data: sensorsForClient,
    meta: {
      count,
      total
    }
  };

}


const sensorUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  name: joi.string(),
  description: joi.string(),
  hasDeployment: joi.string().allow(null),
  permanentHost: joi.string().allow(null),
  initialConfig: joi.array().items(configSchema),
  currentConfig: joi.array().items(configSchema)
})
.min(1)
.required(); 

// When it comes to adding/removing sensors to platforms and deployments, this is handled elsewhere, e.g. via registration keys.
export async function updateSensor(id: string, updates: any): Promise<SensorClient> {

  logger.debug(`Updating sensor '${id}'`);

  // First let's get the current sensor details
  const oldSensor = await sensorService.getSensor(id);

  const {error: validationErr, value: validUpdates} = sensorUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // If the sensor will have a permanentHost, then hasDeployment cannot be set here, the mechanism for adding the sensor to the deployment would be via the registrationKey of the permanentHost
  if ((validUpdates.permanentHost || (oldSensor.permanentHost && validUpdates.permanentHost !== null)) && updates.hasDeployment) {
    throw new BadRequest(`It is not possible to set 'hasDeployment' when the sensor will have a permanent host.`);
  }

  // Make sure no more than 1 initialConfig object has hasPriority set to true.
  if (updates.initialConfig) {
    const nTrue = updates.initialConfig.reduce(configReduceFunction, 0);
    if (nTrue > 1) {
      throw new InvalidSensor(`More than one object in you initialConfig array has 'hasPriority: true'.`);
    }
  }
  // Do the same for the currentConfig object
  if (updates.currentConfig) {
    const nTrue = updates.currentConfig.reduce(configReduceFunction, 0);
    if (nTrue > 1) {
      throw new InvalidSensor(`More than one object in you currentConfig array has 'hasPriority: true'.`);
    }
  }

  const permanentHostChange = check.containsKey(validUpdates, 'permanentHost') && 
    oldSensor.permanentHost !== validUpdates.permanentHost &&
    !(!oldSensor.permanentHost && validUpdates.permanentHost === null);

  const hasDeploymentChange = check.containsKey(validUpdates, 'hasDeployment') && 
    oldSensor.hasDeployment !== validUpdates.hasDeployment &&
    !(!oldSensor.hasDeployment && validUpdates.hasDeployment === null);

  if (hasDeploymentChange && oldSensor.isHostedBy) {
    throw new BadRequest(`The sensor is still hosted by the '${oldSensor.isHostedBy}' platform. You cannot change its deployment until the sensor is removed from this platform.`);
    // If we didn't do this we might have issues with the platform the sensor was on was shared.
  }

  if (permanentHostChange && (oldSensor.isHostedBy)) {
    throw new BadRequest(`The sensor is still hosted by the '${oldSensor.isHostedBy}' platform. You cannot change the permanent host until the platform is removed from this platform.`);
  }

  // Only allow the user to set the permanentHost if the sensor won't be assigned to a deployment
  if (permanentHostChange && validUpdates.permanentHost && oldSensor.hasDeployment && validUpdates.hasDeployment !== null) {
    throw new BadRequest(`The sensor cannot be assigned a permanent host when it is, or will be, in a deployment.`);
  }

  let permanentHost;
  if (validUpdates.permanentHost) {
    // Check this permanent host exists
    permanentHost = await permanentHostService.getPermanentHost(validUpdates.permanentHost);
  }

  // If it's being removed from a permanent host, and the permanent host was using this sensor to update its location, then we'll need to update the permanent host too.
  if (check.null(validUpdates.permamentHost) && permanentHost && permanentHost.updateLocationWithSensor === id) {
    await permanentHostService.updatePermanentHost(permanentHost.id, {updateLocationWithSensor: null});
  }

  const updatedSensor = await sensorService.updateSensor(id, validUpdates);
  logger.debug(`Sensor '${id}' updated.`);

  // Get the existing context (there should always be one)
  const existingContext = await contextService.getLiveContextForSensor(id);

  let contextUpdateRequired;
  const transitionDate = new Date();

  const potentialNewContext: ContextApp = {
    sensor: id,
    startDate: transitionDate,
    config: updatedSensor.currentConfig
  };

  if (!hasDeploymentChange) {
    // We can inherit the hostedByPath from the previous context if the deployment isn't being changed
    if (existingContext.hostedByPath) {
      potentialNewContext.hostedByPath = existingContext.hostedByPath;
    }
  }

  // To do a proper comparison I need to remove the IDs as these end up being different.
  const existingContextConfigNoIds = cloneDeep(existingContext.config).map((config) => {
    delete config.id;
    return config;
  });
  const sensorCurrentConfigNoIds = cloneDeep(updatedSensor.currentConfig).map((config) => {
    delete config.id;
    return config;
  });
  // A change to the config will require a context update
  if (!isEqual(existingContextConfigNoIds, sensorCurrentConfigNoIds)) {
    contextUpdateRequired = true;
  }

  // A change to the deployment will also require a context update
  if (hasDeploymentChange) {
    contextUpdateRequired = true;
    if (validUpdates.hasDeployment) {
      potentialNewContext.inDeployments = [validUpdates.hasDeployment];
    }
  } else {
    // Inherit whatever it was before
    if (existingContext.inDeployments) {
      potentialNewContext.inDeployments = existingContext.inDeployments;
    }
  }

  if (contextUpdateRequired) {

    logger.debug(`Context for sensor ${id} needs updating.`);

    // End current context
    const transitionDate = new Date();
    await contextService.endLiveContextForSensor(id, transitionDate);

    // Create the new context
    const createdContext = await contextService.createContext(potentialNewContext);
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
  if (platform.inDeployments.includes(sensor.hasDeployment)) {
    hasAccessToPlatform = true;
  } else {
    // Is the platform's owner deployment public?
    const platformDeployment: DeploymentApp = await deploymentService.getDeployment(platform.ownerDeployment);
    if (platformDeployment.public) {
      hasAccessToPlatform = true;
    }
  }
  if (!hasAccessToPlatform) {
    throw new InvalidSensor(`Platform '${platformId} is either not associated with the '${sensor.hasDeployment}' deployment, or it is in a private deployment. Therefore sensor '${sensorId}' cannot be hosted on it.`);
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

  // If this sensor is hosted on a permanentHost then we'll need to make sure this permanentHost isn't using this sensor to update it's location, if so we need to change this.
  const sensor = await sensorService.getSensor(id);
  if (sensor.permanentHost) {
    const permanentHost = await permanentHostService.getPermanentHost(sensor.permanentHost);
    if (permanentHost.updateLocationWithSensor === id) {
      await permanentHostService.updatePermanentHost(permanentHost.id, {updateLocationWithSensor: null});
    }
  }

  await contextService.endLiveContextForSensor(id, new Date());
  await sensorService.deleteSensor(id);
  await platformService.removeSensorFromAnyMatchingUpdateLocationWithSensor(id);

  return;

}



function configReduceFunction(count: number, config): number {
  if (config.hasPriority === true) {
    return count + 1;
  } else {
    return count;
  }
}