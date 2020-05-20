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
import {concat, isEqual, cloneDeep, omit} from 'lodash';
import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from '../../utils/id-generator';
import {deleteUnknownSensor} from '../unknown-sensor/unknown-sensor.service';
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
  isHostedBy: joi.string(),
  initialConfig: joi.array().items(configSchema)
})
// If an ID isn't provided, then hasDeployment must be, as this indicates that a deployment sensor is being created.
.or('id', 'hasDeployment')
// If a sensor has a permanentHost then it can be assigned to a deployment or platform at the same time. The mechanism for adding the sensor to a deployment is via a registration key.
.without('permanentHost', ['hasDeployment', 'isHostedBy'])
// We don't want a sensor to be hosted on a platform without it also having its deployment set.
.with('isHostedBy', 'hasDeployment')
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
    await validateSensorConfigArray(sensor.initialConfig);
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
    // Add the deployment to the context
    context.hasDeployment = sensor.hasDeployment;
  }

  // Check the platform exists if provided
  if (sensor.isHostedBy) {
    const hostPlatform = await platformService.getPlatform(sensor.isHostedBy);
    // Add the platform path to the context
    context.hostedByPath = hostPlatform.hostedByPath ? concat(hostPlatform.hostedByPath, hostPlatform.id) : [hostPlatform.id];
  }

  // Check the permanent host exists if provided
  if (sensor.permanentHost) {
    await permanentHostService.getPermanentHost(sensor.permanentHost);
  }

  // Has any config been set for the sensor that should be used in the context.
  context.config = sensor.initialConfig || [];

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

  if (isHostedByStatus.willBeSet && !hasDeploymentStatus.willBeSet) {
    throw new Forbidden(`A sensor cannot be hosted on a platform when the sensor has not been allocated to a deployment.`);
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
    await validateSensorConfigArray(updates.initialConfig);
  }
  // Do the same for the currentConfig object
  if (updates.initialConfig) {
    await validateSensorConfigArray(updates.currentConfig);
  }

  let newHostPlatform;
  if (isHostedByStatus.settingNow) {

    // This will check if it actually exists
    newHostPlatform = await platformService.getPlatform(validUpdates.isHostedBy);
    // N.B. we'll allow sensor can be hosted on a platfrom from another deployment.

    // We also don't want any more sensors being hosted on a platform that was initialised from a permanentHost.
    if (check.assigned(newHostPlatform.initialisedFrom)) {
      throw new Forbidden('Platforms added to a deployment via the registraion process are not permitted to host any more sensors');
    }
  }

  // If the sensor is being removed from a platform then it can no longer be used to update the location of a platform.
  if (isHostedByStatus.unsettingNow) {
    await platformService.removeSensorFromAnyMatchingUpdateLocationWithSensor(id);
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
    potentialNewContext.hostedByPath = newHostPlatform.isHostedBy ? concat(newHostPlatform.hostedByPath, newHostPlatform.id) : [newHostPlatform.id];
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

