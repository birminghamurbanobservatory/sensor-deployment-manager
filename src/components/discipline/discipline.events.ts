import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {DisciplineClient} from './discipline-client.class';
import {createDiscipline, getDiscipline, getDisciplines, updateDiscipline, deleteDiscipline} from './discipline.controller';

export async function subscribeToDisciplineEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToDisciplineCreateRequests,
    subscribeToDisciplinesGetRequests,
    subscribeToDisciplineGetRequests,
    subscribeToDisciplineUpdateRequests,
    subscribeToDisciplineDeleteRequests
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
// Create Discipline
//-------------------------------------------------
async function subscribeToDisciplineCreateRequests(): Promise<any> {
  
  const eventName = 'discipline.create.request';

  const disciplineCreateRequestSchema = joi.object({
    new: joi.object({
      // We'll let the controller check this part
    })
    .unknown()
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let created: DisciplineClient;
    try {
      const {error: err} = disciplineCreateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      created = await createDiscipline(message.new);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return created;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Get Discipline
//-------------------------------------------------
async function subscribeToDisciplineGetRequests(): Promise<any> {

  const eventName = 'discipline.get.request';

  const disciplineGetRequestSchema = joi.object({
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

    let found: DisciplineClient;
    try {
      const {error: err} = disciplineGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      found = await getDiscipline(message.where.id, message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return found;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Get Disciplines
//-------------------------------------------------
async function subscribeToDisciplinesGetRequests(): Promise<any> {

  const eventName = 'disciplines.get.request';

  const disciplinesGetRequestSchema = joi.object({
    where: joi.object({}).unknown(), // let the controller check this
    options: joi.object({}).unknown() // let the controller check this
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let response;
    try {
      const {error: err} = disciplinesGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      response = await getDisciplines(message.where, message.options);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return response;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Update Discipline
//-------------------------------------------------
async function subscribeToDisciplineUpdateRequests(): Promise<any> {
  
  const eventName = 'discipline.update.request';
  const disciplineUpdateRequestSchema = joi.object({
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

    let updated: DisciplineClient;
    try {
      const {error: err} = disciplineUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      updated = await updateDiscipline(message.where.id, message.updates);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updated;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Delete Discipline
//-------------------------------------------------
async function subscribeToDisciplineDeleteRequests(): Promise<any> {
  
  const eventName = 'discipline.delete.request';
  const disciplineDeleteRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    try {
      const {error: err} = disciplineDeleteRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      await deleteDiscipline(message.where.id);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}

