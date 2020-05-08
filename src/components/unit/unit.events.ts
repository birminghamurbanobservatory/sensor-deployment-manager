import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {UnitClient} from './unit-client.class';
import {createUnit, getUnit, getUnits, updateUnit, deleteUnit} from './unit.controller';

export async function subscribeToUnitEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToUnitCreateRequests,
    subscribeToUnitsGetRequests,
    subscribeToUnitGetRequests,
    subscribeToUnitUpdateRequests,
    subscribeToUnitDeleteRequests
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
// Create Unit
//-------------------------------------------------
async function subscribeToUnitCreateRequests(): Promise<any> {
  
  const eventName = 'unit.create.request';

  const unitCreateRequestSchema = joi.object({
    new: joi.object({
      // We'll let the controller check this part
    })
    .unknown()
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let created: UnitClient;
    try {
      const {error: err} = unitCreateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      created = await createUnit(message.new);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return created;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Get Unit
//-------------------------------------------------
async function subscribeToUnitGetRequests(): Promise<any> {

  const eventName = 'unit.get.request';

  const unitGetRequestSchema = joi.object({
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

    let found: UnitClient;
    try {
      const {error: err} = unitGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      found = await getUnit(message.where.id, message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return found;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Get Units
//-------------------------------------------------
async function subscribeToUnitsGetRequests(): Promise<any> {

  const eventName = 'units.get.request';

  const unitsGetRequestSchema = joi.object({
    where: joi.object({}).unknown(), // let the controller check this
    options: joi.object({}).unknown() // let the controller check this
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let response;
    try {
      const {error: err} = unitsGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      response = await getUnits(message.where, message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return response;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Update Unit
//-------------------------------------------------
async function subscribeToUnitUpdateRequests(): Promise<any> {
  
  const eventName = 'unit.update.request';
  const unitUpdateRequestSchema = joi.object({
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

    let updated: UnitClient;
    try {
      const {error: err} = unitUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      updated = await updateUnit(message.where.id, message.updates);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updated;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Delete Unit
//-------------------------------------------------
async function subscribeToUnitDeleteRequests(): Promise<any> {
  
  const eventName = 'unit.delete.request';
  const unitDeleteRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    try {
      const {error: err} = unitDeleteRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      await deleteUnit(message.where.id);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}

