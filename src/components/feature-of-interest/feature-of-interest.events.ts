import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {FeatureOfInterestClient} from './feature-of-interest-client.class';
import {createFeatureOfInterest, getFeatureOfInterest, getFeaturesOfInterest, updateFeatureOfInterest, deleteFeatureOfInterest} from './feature-of-interest.controller';

export async function subscribeToFeatureOfInterestEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToFeatureOfInterestCreateRequests,
    subscribeToFeaturesOfInterestGetRequests,
    subscribeToFeatureOfInterestGetRequests,
    subscribeToFeatureOfInterestUpdateRequests,
    subscribeToFeatureOfInterestDeleteRequests
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
// Create FeatureOfInterest
//-------------------------------------------------
async function subscribeToFeatureOfInterestCreateRequests(): Promise<any> {
  
  const eventName = 'feature-of-interest.create.request';

  const featureOfIinterestCreateRequestSchema = joi.object({
    new: joi.object({
      // We'll let the controller check this part
    })
    .unknown()
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let created: FeatureOfInterestClient;
    try {
      const {error: err} = featureOfIinterestCreateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      created = await createFeatureOfInterest(message.new);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return created;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Get FeatureOfInterest
//-------------------------------------------------
async function subscribeToFeatureOfInterestGetRequests(): Promise<any> {

  const eventName = 'feature-of-interest.get.request';

  const featureOfIinterestGetRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
    .required(),
    options: joi.object({
      // let the controller check this
    }).unknown()
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let found: FeatureOfInterestClient;
    try {
      const {error: err} = featureOfIinterestGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      found = await getFeatureOfInterest(message.where.id, message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return found;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Get FeaturesOfInterest
//-------------------------------------------------
async function subscribeToFeaturesOfInterestGetRequests(): Promise<any> {

  const eventName = 'features-of-interest.get.request';

  const featuresOfIinterestGetRequestSchema = joi.object({
    where: joi.object({}).unknown(), // let the controller check this
    options: joi.object({}).unknown() // let the controller check this
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let response;
    try {
      const {error: err} = featuresOfIinterestGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      response = await getFeaturesOfInterest(message.where, message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return response;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Update FeatureOfInterest
//-------------------------------------------------
async function subscribeToFeatureOfInterestUpdateRequests(): Promise<any> {
  
  const eventName = 'feature-of-interest.update.request';
  const featureOfIinterestUpdateRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
      .required(),
    updates: joi.object({}) // let the service check this
      .unknown()
      .min(1)
      .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let updated: FeatureOfInterestClient;
    try {
      const {error: err} = featureOfIinterestUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      updated = await updateFeatureOfInterest(message.where.id, message.updates);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updated;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Delete FeatureOfInterest
//-------------------------------------------------
async function subscribeToFeatureOfInterestDeleteRequests(): Promise<any> {
  
  const eventName = 'feature-of-interest.delete.request';
  const featureOfIinterestDeleteRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    try {
      const {error: err} = featureOfIinterestDeleteRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      await deleteFeatureOfInterest(message.where.id);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}

