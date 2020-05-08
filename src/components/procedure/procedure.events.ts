import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {ProcedureClient} from './procedure-client.class';
import {createProcedure, getProcedure, getProcedures, updateProcedure, deleteProcedure} from './procedure.controller';

export async function subscribeToProcedureEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToProcedureCreateRequests,
    subscribeToProceduresGetRequests,
    subscribeToProcedureGetRequests,
    subscribeToProcedureUpdateRequests,
    subscribeToProcedureDeleteRequests
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
// Create Procedure
//-------------------------------------------------
async function subscribeToProcedureCreateRequests(): Promise<any> {
  
  const eventName = 'procedure.create.request';

  const procedureCreateRequestSchema = joi.object({
    new: joi.object({
      // We'll let the controller check this part
    })
    .unknown()
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let created: ProcedureClient;
    try {
      const {error: err} = procedureCreateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      created = await createProcedure(message.new);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return created;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Get Procedure
//-------------------------------------------------
async function subscribeToProcedureGetRequests(): Promise<any> {

  const eventName = 'procedure.get.request';

  const procedureGetRequestSchema = joi.object({
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

    let found: ProcedureClient;
    try {
      const {error: err} = procedureGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      found = await getProcedure(message.where.id, message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return found;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Get Procedures
//-------------------------------------------------
async function subscribeToProceduresGetRequests(): Promise<any> {

  const eventName = 'procedures.get.request';

  const proceduresGetRequestSchema = joi.object({
    where: joi.object({}).unknown(), // let the controller check this
    options: joi.object({}).unknown() // let the controller check this
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let response;
    try {
      const {error: err} = proceduresGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      response = await getProcedures(message.where, message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return response;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Update Procedure
//-------------------------------------------------
async function subscribeToProcedureUpdateRequests(): Promise<any> {
  
  const eventName = 'procedure.update.request';
  const procedureUpdateRequestSchema = joi.object({
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

    let updated: ProcedureClient;
    try {
      const {error: err} = procedureUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      updated = await updateProcedure(message.where.id, message.updates);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updated;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Delete Procedure
//-------------------------------------------------
async function subscribeToProcedureDeleteRequests(): Promise<any> {
  
  const eventName = 'procedure.delete.request';
  const procedureDeleteRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    try {
      const {error: err} = procedureDeleteRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      await deleteProcedure(message.where.id);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}

