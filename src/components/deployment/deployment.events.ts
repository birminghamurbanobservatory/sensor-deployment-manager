import * as event from 'event-stream';
import {createDeployment, getDeployments, getDeployment, updateDeployment, deleteDeployment} from './deployment.controller';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {DeploymentClient} from './deployment-client.class';

export async function subscribeToDeploymentEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToDeploymentCreateRequests,
    subscribeToDeploymentsGetRequests,
    subscribeToDeploymentGetRequests,
    subscribeToDeploymentUpdateRequests,
    subscribeToDeploymentDeleteRequests
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
// Create Deployment
//-------------------------------------------------
async function subscribeToDeploymentCreateRequests(): Promise<any> {
  
  const eventName = 'deployment.create.request';

  const deploymentCreateRequestSchema = joi.object({
    new: joi.object({
      // We'll let the deployment.service check this part
    })
    .unknown()
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let createdDeployment: DeploymentClient;
    try {
      const {error: err} = deploymentCreateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      createdDeployment = await createDeployment(message.new);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return createdDeployment;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Get Deployment
//-------------------------------------------------
async function subscribeToDeploymentGetRequests(): Promise<any> {

  const eventName = 'deployment.get.request';

  const deploymentGetRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
    .required()
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let deployment: DeploymentClient;
    try {
      const {error: err} = deploymentGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      deployment = await getDeployment(message.where.id);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return deployment;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Get Deployments
//-------------------------------------------------
async function subscribeToDeploymentsGetRequests(): Promise<any> {

  const eventName = 'deployments.get.request';

  const deploymentsGetRequestSchema = joi.object({
    where: joi.object({
      user: joi.string(),
      public: joi.boolean()
    })
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let deployments: DeploymentClient[];
    try {
      const {error: err} = deploymentsGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      deployments = await getDeployments(message.where);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return deployments;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}


//-------------------------------------------------
// Update Deployment
//-------------------------------------------------
async function subscribeToDeploymentUpdateRequests(): Promise<any> {
  
  const eventName = 'deployment.update.request';
  const deploymentUpdateRequestSchema = joi.object({
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

    let updatedDeployment: DeploymentClient;
    try {
      const {error: err} = deploymentUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      updatedDeployment = await updateDeployment(message.where.id, message.updates);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updatedDeployment;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Delete Deployment
//-------------------------------------------------
async function subscribeToDeploymentDeleteRequests(): Promise<any> {
  
  const eventName = 'deployment.delete.request';
  const deploymentDeleteRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    try {
      const {error: err} = deploymentDeleteRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      await deleteDeployment(message.where.id);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}

