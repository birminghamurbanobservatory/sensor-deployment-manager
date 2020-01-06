import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {register} from './registration.controller';

export async function subscribeToRegistrationEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToRegistrationRequests
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
// Submit a registration key
//-------------------------------------------------
async function subscribeToRegistrationRequests(): Promise<any> {
  
  const eventName = 'registration.request';

  const registrationRequestSchema = joi.object({
    where: joi.object({
      registrationKey: joi.string().required(),
      deploymentId: joi.string().required()
    })
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let created;
    try {
      const {error: err} = registrationRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      created = await register(message.where.registrationKey, message.where.deploymentId);
      return created;
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return created;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}




