import * as event from 'event-stream';
import {updateContext} from './context.controller';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {ContextClient} from './context-client.class';

export async function subscribeToContextEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToContextUpdateRequests
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
// Update Context
//-------------------------------------------------
async function subscribeToContextUpdateRequests(): Promise<any> {

  const eventName = 'context.update.request';
  const contextUpdateRequestSchema = joi.object({
    where: joi.object({
      sensor: joi.string().required(),
      deployment: joi.string()
    })
      .required(),
    // This is not where the inDeployment and isHostedBy fields are changed, this is done by updating a sensor.
    updates: joi.object({
      toAdd: joi.object({
        observedProperty: joi.any(),
        hasFeatureOfInterest: joi.any(),
        usedProcedures: joi.any()
      })
        .min(1)
        .required()
    })
      .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let updatedContext: ContextClient;
    try {
      const {error: err} = contextUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      updatedContext = await updateContext(message.where.id, message.updates);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updatedContext;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}

