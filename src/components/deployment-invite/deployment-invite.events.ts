import * as event from 'event-stream';
import * as logger from 'node-logger';
import {Promise} from 'bluebird'; 
import {logCensorAndRethrow} from '../../events/handle-event-handler-error';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {DeploymentInviteClient} from './deployment-invite-client.interface';
import {DeploymentClient} from '../deployment/deployment-client.class';
import {acceptDeploymentInvite, createDeploymentInvite, getDeploymentInvite} from './deployment-invite.controller';


export async function subscribeToDeploymentInviteEvents(): Promise<void> {

  const subscriptionFunctions = [
    subscribeToDeploymentInviteCreateRequests,
    subscribeToDeploymentInviteGetRequests,
    subscribeToDeploymentInviteAcceptRequests
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
// Create Deployment Invite
//-------------------------------------------------
async function subscribeToDeploymentInviteCreateRequests(): Promise<any> {
  
  const eventName = 'deployment-invite.create.request';

  const deploymentInviteCreateRequestSchema = joi.object({
    new: joi.object({
      // We'll let the service check this part
    })
    .unknown()
    .required()
  }).required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let createdDeploymentInvite: DeploymentInviteClient;
    try {
      const {error: err} = deploymentInviteCreateRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);    
      createdDeploymentInvite = await createDeploymentInvite(message.new);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return createdDeploymentInvite;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;
}


//-------------------------------------------------
// Get Deployment Invite
//-------------------------------------------------
async function subscribeToDeploymentInviteGetRequests(): Promise<any> {

  const eventName = 'deployment-invite.get.request';

  const deploymentInviteGetRequestSchema = joi.object({
    where: joi.object({
      id: joi.string().required()
    })
    .required()
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let deploymentInvite: DeploymentInviteClient;
    try {
      const {error: err} = deploymentInviteGetRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      deploymentInvite = await getDeploymentInvite(message.where.id);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return deploymentInvite;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}




//-------------------------------------------------
// Accept Deployment Invite
//-------------------------------------------------
async function subscribeToDeploymentInviteAcceptRequests(): Promise<any> {

  const eventName = 'deployment-invite.accept.request';

  const deploymentInviteAcceptRequestSchema = joi.object({
    inviteId: joi.string().required(),
    userId: joi.string().required()
  })
  .required();

  await event.subscribe(eventName, async (message): Promise<void> => {

    logger.debug(`New ${eventName} message.`, message);

    let updatedDeployment: DeploymentClient;
    try {
      const {error: err} = deploymentInviteAcceptRequestSchema.validate(message);
      if (err) throw new BadRequest(`Invalid ${eventName} request: ${err.message}`);
      updatedDeployment = await acceptDeploymentInvite(message.inviteId, message.userId);
    } catch (err) {
      logCensorAndRethrow(eventName, err);
    }

    return updatedDeployment;
  });

  logger.debug(`Subscribed to ${eventName} requests`);
  return;  

}



