import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {UsedProcedureClient} from './used-procedure-client.class';
import {createUsedProcedure, getUsedProcedure, getUsedProcedures, updateUsedProcedure, deleteUsedProcedure} from './used-procedure.controller';

export async function subscribeToUsedProcedureEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToUsedProcedureCreateRequests,
    subscribeToUsedProceduresGetRequests,
    subscribeToUsedProcedureGetRequests,
    subscribeToUsedProcedureUpdateRequests,
    subscribeToUsedProcedureDeleteRequests
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
// Create Used Procedure
//-------------------------------------------------
async function subscribeToUsedProcedureCreateRequests(): Promise<any> {
  
  const eventName = 'used-procedure.create.request';

  const usedProcedureCreateRequestSchema = joi.object({
    new: joi.object({
      // We'll let the controller check this part
    })
    .unknown()
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let created: UsedProcedureClient;
    try {
      const {error: err} = usedProcedureCreateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      created = await createUsedProcedure(message.new);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return created;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Get Used Procedure
//-------------------------------------------------
async function subscribeToUsedProcedureGetRequests(): Promise<any> {

  const eventName = 'used-procedure.get.request';

  const usedProcedureGetRequestSchema = joi.object({
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

    let found: UsedProcedureClient;
    try {
      const {error: err} = usedProcedureGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      found = await getUsedProcedure(message.where.id, message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return found;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Get Used Procedures
//-------------------------------------------------
async function subscribeToUsedProceduresGetRequests(): Promise<any> {

  const eventName = 'used-procedures.get.request';

  const usedProceduresGetRequestSchema = joi.object({
    where: joi.object({}).unknown(), // let the controller check this
    options: joi.object({}).unknown() // let the controller check this
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let response;
    try {
      const {error: err} = usedProceduresGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      response = await getUsedProcedures(message.where, message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return response;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Update Used Procedure
//-------------------------------------------------
async function subscribeToUsedProcedureUpdateRequests(): Promise<any> {
  
  const eventName = 'used-procedure.update.request';
  const usedProcedureUpdateRequestSchema = joi.object({
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

    let updated: UsedProcedureClient;
    try {
      const {error: err} = usedProcedureUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      updated = await updateUsedProcedure(message.where.id, message.updates);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updated;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Delete Used Procedure
//-------------------------------------------------
async function subscribeToUsedProcedureDeleteRequests(): Promise<any> {
  
  const eventName = 'used-procedure.delete.request';
  const usedProcedureDeleteRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    try {
      const {error: err} = usedProcedureDeleteRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      await deleteUsedProcedure(message.where.id);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}

