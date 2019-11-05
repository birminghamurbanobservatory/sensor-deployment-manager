import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {createPermanentHost} from './permanent-host.controller';
import {PermanentHostClient} from './permanent-host-client.class';


export async function subscribeToPermanentHostEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToPermanentHostCreateRequests,
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
// Create Permanent Host
//-------------------------------------------------
async function subscribeToPermanentHostCreateRequests(): Promise<any> {
  
  const eventName = 'permanent-host.create.request';

  const platformCreateRequestSchema = joi.object({
    new: joi.object({
      // We'll let the controller/service check this part
    })
    .unknown()
    .required(),
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let createdPermanentHost: PermanentHostClient;
    try {
      const {error: err} = platformCreateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      createdPermanentHost = await createPermanentHost(message.new);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return createdPermanentHost;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


