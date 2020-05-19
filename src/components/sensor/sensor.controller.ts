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
import {concat, isEqual, cloneDeep, omit} from 'lodash';
import {CannotUnhostSensorWithPermanentHost} from './errors/CannotUnhostSensorWithPermanentHost';
import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from '../../utils/id-generator';
import {CannotHostSensorOnPermanentHost} from './errors/CannotHostSensorOnPermanentHost';
import {deleteUnknownSensor} from '../unknown-sensor/unknown-sensor.service';
import {PaginationOptions} from '../common/pagination-options.class';
import {CollectionOptions} from '../common/collection-options.class';
import {calculateChangeStatus} from '../../utils/change-status';
import {Forbidden} from '../../errors/Forbidden';
import {validateSensorConfigArray} from './sensor-config.service';


//-------------------------------------------------
// Create Sensor
//-------------------------------------------------
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
  description: joi.string().allow(''),
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
    validateSensorConfigArray(sensor.initialConfig);
  }

  // If the sensor has an id, then check it won't clash with an auto-generated one
  if (sensor.id && hasIdBeenGenerated(sensor.id)) {
    throw new InvalidSensor(`Sensor ID cannot end with '${suffixForGeneratedIds}'`);
  }

  // If the sensor doesn't have an id then assign one
  if (!sensor.id) {
    sensor.id = generateId(sensor.name);
  } 

  // If the sensor does not have a name yet then simply use the id.
  if (!sensor.name) {
    sensor.name = sensor.id;
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
    context.hasDeployment = sensor.hasDeployment;
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


//-------------------------------------------------
// Get Sensor
//-------------------------------------------------
const getSensorOptions = joi.object({
  includeDeleted: joi.boolean()
});

export async function getSensor(id: string, options = {}): Promise<SensorClient> {

  const {error: err, value: validOptions} = getSensorOptions.validate(options);
  if (err) throw new BadRequest(`Invalid 'options' object: ${err.message}`);

  const sensor: SensorApp = await sensorService.getSensor(id, validOptions);
  logger.debug('Sensor found', sensor);
  return sensorService.sensorAppToClient(sensor);

}


//-------------------------------------------------
// Get Sensors
//-------------------------------------------------
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
}).required();

const getSensorsOptionsSchema = joi.object({
  limit: joi.number().integer().positive(),
  offset: joi.number().integer().min(0),
  sortBy: joi.string().valid('id'),
  sortOrder: joi.string().valid('asc', 'desc'),
  includeDeleted: joi.boolean(),
}).required();

export async function getSensors(where: any, options: CollectionOptions = {}): Promise<{data: SensorClient[]; meta: any}> {

  const {error: whereErr, value: validWhere} = getSensorsWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid where object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getSensorsOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid options object: ${optionsErr.message}`);

  const {data: sensors, count, total} = await sensorService.getSensors(validWhere, validOptions);
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


//-------------------------------------------------
// Update Sensor
//-------------------------------------------------
const sensorUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  name: joi.string(),
  description: joi.string().allow(''),
  hasDeployment: joi.string().allow(null),
  permanentHost: joi.string().allow(null),
  isHostedBy: joi.string().allow(null),
  initialConfig: joi.array().items(configSchema),
  currentConfig: joi.array().items(configSchema)
})
.min(1)
.required(); 

// When it comes to adding/removing permantly hosted sensors to platforms and deployments, this is handled elsewhere, e.g. via registration keys.
export async function updateSensor(id: string, updates: any): Promise<SensorClient> {

  logger.debug(`Updating sensor '${id}'`);

  // First let's get the current sensor details
  const oldSensor = await sensorService.getSensor(id);

  const {error: validationErr, value: validUpdates} = sensorUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  const permanentHostStatus = calculateChangeStatus('permanentHost', oldSensor, validUpdates);
  const hasDeploymentStatus = calculateChangeStatus('hasDeployment', oldSensor, validUpdates);
  const isHostedByStatus = calculateChangeStatus('isHostedBy', oldSensor, validUpdates);

  if (permanentHostStatus.willBeSet && hasDeploymentStatus.settingNow) {
    throw new Forbidden(`It is not possible to set 'hasDeployment' when the sensor has (or will have) a permanent host.`);
    // N.B. The proper mechanism for adding a permantly hosted sensor to a deployment would be by registering the permanentHost to the deployment.
  }

  if (permanentHostStatus.isChanging && isHostedByStatus.wasSet) {
    throw new Forbidden(`The sensor is still hosted by the '${oldSensor.isHostedBy}' platform. You cannot change the permanent host until the platform is removed from this platform.`);
  }

  if (permanentHostStatus.isChanging && hasDeploymentStatus.willBeSet) {
    throw new Forbidden('The permanent host cannot be changed whilst a sensor is in (or about to be in) a deployment.');
  }

  if (isHostedByStatus.settingNow && !hasDeploymentStatus.willBeSet) {
    throw new Forbidden('A sensor can only be hosted on a platform when it is (or will be) in a deployment.');
  }

  if (isHostedByStatus.settingNow && permanentHostStatus.willBeSet) {
    throw new Forbidden('A sensor can only be directly hosted on a platform when it has (or will have) a permanent host.');
  }

  if (isHostedByStatus.isChanging && permanentHostStatus.wasSet) {
    throw new Forbidden('A sensor with a permanent host cannot have its host platform changed.');
  }

  if (hasDeploymentStatus.isChanging && permanentHostStatus.wasSet) {
    throw new Forbidden('A sensor with a permanent host cannot have its deployment changed.');
  }

  if (hasDeploymentStatus.settingNow && hasDeploymentStatus.isChanging && isHostedByStatus.wasSet && !isHostedByStatus.isChanging) {
    throw new Forbidden('A sensor being assigned to a new deployment cannot remain hosted on the same platform.');
  }

  if (hasDeploymentStatus.unsettingNow && isHostedByStatus.willBeSet) {
    throw new Forbidden('A sensor being removed from a deployment cannot remain on, or be added to, a platform.');
  }

  let permanentHost;
  if (validUpdates.permanentHost) {
    // Check this permanent host exists
    permanentHost = await permanentHostService.getPermanentHost(validUpdates.permanentHost);
  }

  // If it's being removed from a permanent host, and the permanent host was using this sensor to update its location, then we'll need to update the permanent host too.
  if (permanentHostStatus.unsettingNow && permanentHost && permanentHost.updateLocationWithSensor === id) {
    await permanentHostService.updatePermanentHost(permanentHost.id, {updateLocationWithSensor: null});
  }

  // Make sure no more than 1 initialConfig object has hasPriority set to true.
  if (updates.initialConfig) {
    validateSensorConfigArray(updates.initialConfig);
  }
  // Do the same for the currentConfig object
  if (updates.initialConfig) {
    validateSensorConfigArray(updates.currentConfig);
  }

  let newHostPlatform;
  if (isHostedByStatus.settingNow) {

    // This will check if it actually exists
    newHostPlatform = await platformService.getPlatform(validUpdates.isHostedBy);

    // For now at least we'll inforce that the platform the sensor is hosted on must be in the same deployment as the sensor.
    if (hasDeploymentStatus.valueWillBe !== newHostPlatform.inDeployment) {
      throw new Forbidden(`The sensor cannot be hosted on a platform that is in a different deployment to the sensor (sensor deployment will be '${hasDeploymentStatus.valueWillBe}').`);
    }

    // We also don't want any more sensors being hosted on a platform that was initialised from a permanentHost.
    if (check.assigned(newHostPlatform.initialisedFrom)) {
      throw new Forbidden('This platforms added to a deployment via the registraion process are not permitted to host any more sensors');
    }
  }

  logger.debug(`Updates for sensor ${id}`, validUpdates);

  const updatedSensor = await sensorService.updateSensor(id, validUpdates);
  logger.debug(`Sensor '${id}' updated.`);

  // Get the existing context (there should always be one)
  const existingContext = await contextService.getLiveContextForSensor(id);
  
  // Start to define the potential new context
  const transitionDate = new Date();
  const potentialNewContext: ContextApp = {
    sensor: id,
    startDate: transitionDate,
    config: updatedSensor.currentConfig
  };

  // Set the context's hostedByPath
  if (isHostedByStatus.settingNow) {
    potentialNewContext.hostedByPath = newHostPlatform.isHostedBy ? concat([newHostPlatform.hostedByPath], [newHostPlatform.id]) : [newHostPlatform.id];
  } else if (existingContext.hostedByPath && !isHostedByStatus.unsettingNow) {
    // Inherit whatever it was before.
    potentialNewContext.hostedByPath = existingContext.hostedByPath;
  }

  // Set the context's hasDeployment
  if (hasDeploymentStatus.settingNow) {
    potentialNewContext.hasDeployment = validUpdates.hasDeployment;
  } else if (existingContext.hasDeployment && !hasDeploymentStatus.unsettingNow) {
    // Inherit whatever it was before.
    potentialNewContext.hasDeployment = existingContext.hasDeployment;
  }

  // Now to see if this new context is any different, if it is then we'll need to create a new context.
  // To do a proper comparison I need to remove certain properties
  const contextPropsToIgnore = ['id', 'startDate'];
  const existingContextForComparison: any = omit(cloneDeep(existingContext), contextPropsToIgnore);
  // And I need to remove the ids from each of the config objects because these end up being different.
  existingContextForComparison.config.forEach((configItem) => {
    delete configItem.id;
  });
  const potentialContextForComparison = omit(cloneDeep(potentialNewContext), contextPropsToIgnore);
  potentialContextForComparison.config.forEach((configItem) => {
    delete configItem.id;
  });

  // A change to the config will require a context update
  const contextUpdateRequired = !isEqual(existingContextForComparison, potentialContextForComparison);

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


// TODO: I had separated the hosting/unhosting of a sensor on a platform from the general updating of sensor, but I've not done both above so all this below can probably go, along with the events (the api-gateway wasn't using these events yet anyway)
//-------------------------------------------------
// Host sensor on platform
//-------------------------------------------------
// IMPORTANT: This is not the procedure by which sensors on permanentHosts are hosted on a platform. This is done via a registration key.
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
  if (platform.inDeployment === sensor.hasDeployment) {
    hasAccessToPlatform = true;
  } else {
    // Is the platform's deployment public?
    const platformDeployment: DeploymentApp = await deploymentService.getDeployment(platform.inDeployment);
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


//-------------------------------------------------
// Unhost sensor
//-------------------------------------------------
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


//-------------------------------------------------
// Delete sensor
//-------------------------------------------------
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

