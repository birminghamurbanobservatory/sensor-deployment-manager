import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {DeploymentUserClient} from './deployment-user-client.class';
import {getDeploymentUsers, getDeploymentUser, updateDeploymentUser, deleteDeploymentUser, getLevelForMultipleDeployments} from './deployment-user-controller';

export async function subscribeToDeploymentUserEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToDeploymentUsersGetRequests,
    subscribeToDeploymentUserGetRequests,
    subscribeToDeploymentUserUpdateRequests,
    subscribeToDeploymentUserDeleteRequests,
    subscribeToDeploymentUserGetLevelsForDeploymentsRequests
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
// Get Deployment Users
//-------------------------------------------------
// Now although another microservice could just make a deployment.get.request which will include an array of users, it worth having separate queues for this. There's two main reasons for this:
// 1. Less data needs to be transferred across the event stream
// 2. More future-proof. For example in the future we may decide not to store the users in the deployment document and thus this microservice may not be able include a users array.
async function subscribeToDeploymentUsersGetRequests(): Promise<any> {
  
  const eventName = 'deployment-users.get.request';

  const deploymentUsersGetRequestSchema = joi.object({
    where: joi.object({
      deploymentId: joi.string().required()
    })
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let deploymentUsers: DeploymentUserClient[];
    try {
      const {error: err} = deploymentUsersGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      deploymentUsers = await getDeploymentUsers(message.where.deploymentId);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return deploymentUsers; // TODO: need to make client friendly?
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Get Deployment User
//-------------------------------------------------
// I.e. handy when you want to find what rights level a user has to a deployment
async function subscribeToDeploymentUserGetRequests(): Promise<any> {

  const eventName = 'deployment-user.get.request';

  const deploymentUserGetRequestSchema = joi.object({
    where: joi.object({
      deploymentId: joi.string().required(),
      userId: joi.string().required()
    })
    .required()
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let deploymentUser: DeploymentUserClient;
    try {
      const {error: err} = deploymentUserGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      deploymentUser = await getDeploymentUser(message.where.deploymentId, message.where.userId);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return deploymentUser;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}



//-------------------------------------------------
// Get for multiple deployments
//-------------------------------------------------
// This rather bespoke event has been added to provide a quick way of finding what rights a single user has to multiple deployments in a single request.
async function subscribeToDeploymentUserGetLevelsForDeploymentsRequests(): Promise<any> {

  const eventName = 'deployment-user.get-levels-for-deployments.request';

  const deploymentUserGetLevelsForDeploymentsSchema = joi.object({
    where: joi.object({
      deploymentIds: joi.array().items(joi.string()).min(1).required(),
      userId: joi.string() // not required, e.g. for when user is unauthenticated.
    })
    .required()
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let deploymentLevels;
    try {
      const {error: err} = deploymentUserGetLevelsForDeploymentsSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      deploymentLevels = await getLevelForMultipleDeployments(message.where.deploymentIds, message.where.userId);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return deploymentLevels;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}



//-------------------------------------------------
// Update Deployment User
//-------------------------------------------------
async function subscribeToDeploymentUserUpdateRequests(): Promise<any> {
  
  const eventName = 'deployment-user.update.request';
  const deploymentUserUpdateRequestSchema = joi.object({
    where: joi.object({
      deploymentId: joi.string().required(),
      userId: joi.string().required()
    }).required(),
    updates: joi.object({}) // let the controller check this
      .unknown()
      .min(1)
      .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let updatedDeploymentUser: DeploymentUserClient;
    try {
      const {error: err} = deploymentUserUpdateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      updatedDeploymentUser = await updateDeploymentUser(message.where.deploymentId, message.where.userId, message.updates);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updatedDeploymentUser;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Delete Deployment User
//-------------------------------------------------
async function subscribeToDeploymentUserDeleteRequests(): Promise<any> {
  
  const eventName = 'deployment-user.delete.request';
  const deploymentUserDeleteRequestSchema = joi.object({
    where: joi.object({
      deploymentId: joi.string().required(),
      userId: joi.string().required()
    })
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    try {
      const {error: err} = deploymentUserDeleteRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);      
      await deleteDeploymentUser(message.where.deploymentId, message.where.userId);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}

