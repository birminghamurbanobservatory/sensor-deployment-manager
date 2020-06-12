import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {addContextToObservation} from './context.controller';
import {ObservationClient} from '../observation/observation-client.class';

export async function subscribeToContextEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToObservationAddContextEvent
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
// Add context to an observation (expects imediate response)
//-------------------------------------------------
async function subscribeToObservationAddContextEvent(): Promise<void> {

  // Note: we haven't included the word 'request' in the eventname, because most of the time requests coming in will expect the updatedObservation to be added to another fire-and-forget queue, rather than expecting a direct RPC reponse. N.B. for the former we don't need to set what queue they'll then be added onto, because it's up to the publisher to decide this. Were the word request used in the eventName the configuration of queue would be different, i.e. faster but less durable.
  const eventName = 'observation.add-context';
  const observationAddContextRequestSchema = joi.object({
    // Worth having this structure in case I ever need to provide any options too.
    observation: joi.object({}).unknown().required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let updatedObservation: ObservationClient;
    try {
      const {error: err} = observationAddContextRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      updatedObservation = await addContextToObservation(message.observation);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updatedObservation;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;

}



