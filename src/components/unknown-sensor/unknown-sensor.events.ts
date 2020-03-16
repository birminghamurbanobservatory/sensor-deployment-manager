import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import * as joi from '@hapi/joi';
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import {UnknownSensorClient} from './unknown-sensor-client.class';
import {getUnknownSensors} from './unknown-sensor.controller';
import {BadRequest} from '../../errors/BadRequest';

export async function subscribeToUnknownSensorEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToUnknownSensorsGetRequests,
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
// Get Unknown Sensors
//-------------------------------------------------
async function subscribeToUnknownSensorsGetRequests(): Promise<any> {

  const eventName = 'unknown-sensors.get.request';

  const unknownSensorGetRequestSchema = joi.object({
    options: joi.object({}).unknown() // let the controller check this
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let results;
    try {
      const {error: err} = unknownSensorGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);   
      results = await getUnknownSensors(message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return results;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}

