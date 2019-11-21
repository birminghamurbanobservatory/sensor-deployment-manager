import * as event from 'event-stream';
import {createSensor, updateSensor, hostSensorOnPlatform, unhostSensorFromPlatform} from './sensor.controller';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {SensorClient} from './sensor-client.class';

export async function subscribeToSensorEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToSensorCreateRequests,
    subscribeToSensorUpdateRequests,
    subscribeToPlatformSensorHostRequests,
    subscribeToPlatformSensorUnhostRequests
  ];

  // I don't want later subscriptions to be prevented, just because an earlier attempt failed, as I want my event-stream module to have all the event names and handler functions added to its list of subscriptions so it can add them again upon a reconnect.
  await Promise.mapSeries(subscriptionFunctions, async (subscriptionFunction): Promise<void> => {
    try {
      await subscriptionFunction();
    } catch (err) {
      if (err.name === 'NoEventStreamConnection') {
        // If it failed to subscribe because the event-stream connection isn't currently down, I still want it to continue adding the other subscriptions, so that the event-stream module has all the event names and handler functions added to its list of subscriptions so it can add them again upon a reconnect.
        logger.warn(`Failed to subscribe due to event-stream connection being down`);
      } else {
        throw err;
      }
    }
    return;
  });

  return;
}


//-------------------------------------------------
// Create Sensor
//-------------------------------------------------
async function subscribeToSensorCreateRequests(): Promise<any> {
  
  const eventName = 'sensor.create.request';

  const sensorCreateRequestSchema = joi.object({
    new: joi.object({
      // We'll let the controller/model check this.
    })
    .unknown()
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let createdSensor: SensorClient;
    try {
      const {error: err} = sensorCreateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      createdSensor = await createSensor(message.new);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return createdSensor;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}



//-------------------------------------------------
// Update Sensor
//-------------------------------------------------
async function subscribeToSensorUpdateRequests(): Promise<any> {
  
  const eventName = 'sensor.update.request';

  const sensorUpdateRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
      .required(),
    updates: joi.object({}) // let the controller and model schemas handle the detailed validation.
      .min(1)
      .unknown()
      .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let createdSensor: SensorClient;
    try {
      const {error: err} = sensorUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      createdSensor = await updateSensor(message.where.id, message.updates);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return createdSensor;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Host sensor on platform
//-------------------------------------------------
async function subscribeToPlatformSensorHostRequests(): Promise<any> {
  
  const eventName = 'platform-sensor.host.request';

  const sensorUpdateRequestSchema = joi.object({
    where: joi.object({
      sensorId: joi.string().required(),
      platformId: joi.string().required()
    })
      .required(),
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let updatedSensor: SensorClient;
    try {
      const {error: err} = sensorUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      updatedSensor = await hostSensorOnPlatform(message.where.sensorId, message.where.platformId);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updatedSensor;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Unhost sensor from platform
//-------------------------------------------------
async function subscribeToPlatformSensorUnhostRequests(): Promise<any> {
  
  const eventName = 'platform-sensor.unhost.request';

  const sensorUpdateRequestSchema = joi.object({
    where: joi.object({
      sensorId: joi.string().required()
    })
      .required(),
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let updatedSensor: SensorClient;
    try {
      const {error: err} = sensorUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      updatedSensor = await unhostSensorFromPlatform(message.where.sensorId);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updatedSensor;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}