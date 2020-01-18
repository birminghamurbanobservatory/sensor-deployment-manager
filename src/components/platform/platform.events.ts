import * as event from 'event-stream';
import {createPlatform, getPlatform, getPlatforms, updatePlatform, unhostPlatform, rehostPlatform, deletePlatform} from './platform.controller';
import * as logger from 'node-logger';
import {Promise} from 'bluebird';
import {PlatformClient} from './platform-client.class';
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';


export async function subscribeToPlatformEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToPlatformCreateRequests,
    subscribeToPlatformsGetRequests,
    subscribeToPlatformGetRequests,
    subscribeToPlatformUpdateRequests,
    subscribeToPlatformUnhostRequests,
    subscribeToPlatformRehostRequests,
    subscribeToPlatformDeleteRequests
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
// Create Platform
//-------------------------------------------------
async function subscribeToPlatformCreateRequests(): Promise<any> {
  
  const eventName = 'platform.create.request';

  const platformCreateRequestSchema = joi.object({
    new: joi.object({
      // We'll let the controller/service check this part
    })
    .unknown()
    .required(),
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let createdPlatform: PlatformClient;
    try {
      const {error: err} = platformCreateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      createdPlatform = await createPlatform(message.new);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return createdPlatform;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}



//-------------------------------------------------
// Get Platform
//-------------------------------------------------
async function subscribeToPlatformGetRequests(): Promise<any> {

  const eventName = 'platform.get.request';

  const platformsGetRequestSchema = joi.object({
    where: joi.object({
      id: joi.string()
        .required()
    })
    .required(),
    options: joi.object({
      includeCurrentLocation: joi.boolean()
        .default(true)
    }).default({includeCurrentLocation: true})
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let platforms: PlatformClient[];
    try {
      const {error: err, value: validatedMsg} = platformsGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      platforms = await getPlatform(validatedMsg.where.id, validatedMsg.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return platforms;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}



//-------------------------------------------------
// Get Platforms
//-------------------------------------------------
async function subscribeToPlatformsGetRequests(): Promise<any> {

  const eventName = 'platforms.get.request';

  const platformsGetRequestSchema = joi.object({
    where: joi.object({
      inDeployment: joi.string()
        .required()
    })
    .min(1)
    .required()
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let platforms: PlatformClient[];
    try {
      const {error: err, value: validatedMsg} = platformsGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      platforms = await getPlatforms(validatedMsg.where);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return platforms;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Update Platform
//-------------------------------------------------
async function subscribeToPlatformUpdateRequests(): Promise<void> {

  const eventName = 'platform.update.request';

  const platformUpdateRequestSchema = joi.object({
    where: joi.object({
      id: joi.string()
        .required()
    })
    .required(),
    updates: joi.object({
      // we'll let the controller check this
    })
    .unknown()
    .required()
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let platforms: PlatformClient[];
    try {
      const {error: err} = platformUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      platforms = await updatePlatform(message.where.id, message.updates);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return platforms;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Unhost Platform
//-------------------------------------------------
async function subscribeToPlatformUnhostRequests(): Promise<void> {

  const eventName = 'platform.unhost.request';

  const platformUnhostRequestSchema = joi.object({
    where: joi.object({
      id: joi.string()
        .required()
    })
    .required()
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let platforms: PlatformClient[];
    try {
      const {error: err} = platformUnhostRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      platforms = await unhostPlatform(message.where.id);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return platforms;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Rehost Platform
//-------------------------------------------------
async function subscribeToPlatformRehostRequests(): Promise<void> {

  const eventName = 'platform.rehost.request';

  const platformRehostRequestSchema = joi.object({
    where: joi.object({
      id: joi.string()
        .required(),
      hostId: joi.string()
        .required()
    })
    .required()
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let platforms: PlatformClient[];
    try {
      const {error: err} = platformRehostRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      platforms = await rehostPlatform(message.where.id, message.where.hostId);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return platforms;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}




//-------------------------------------------------
// Delete Platform
//-------------------------------------------------
async function subscribeToPlatformDeleteRequests(): Promise<any> {

  const eventName = 'platform.delete.request';

  const platformsDeleteRequestSchema = joi.object({
    where: joi.object({
      id: joi.string()
        .required()
    })
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    try {
      const {error: err, value: validatedMsg} = platformsDeleteRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      await deletePlatform(validatedMsg.where.id);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}
