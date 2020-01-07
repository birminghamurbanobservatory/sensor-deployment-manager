import * as event from 'event-stream';import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {getPlatformLocations} from './platform-location.controller';
import {PlatformLocationClient} from './platform-location-client';


export async function subscribeToPlatformLocationEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToPlatformLocationsGetRequests,
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
// Get a Platform's locations
//-------------------------------------------------
async function subscribeToPlatformLocationsGetRequests(): Promise<any> {

  const eventName = 'platform-locations.get.request';

  const platformsGetRequestSchema = joi.object({
    where: joi.object({
      platformId: joi.string()
        .required()
    })
    .required(),
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let locations: PlatformLocationClient[];
    try {
      const {error: err, value: validatedMsg} = platformsGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      locations = await getPlatformLocations(validatedMsg.where.platformId);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return locations;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}

