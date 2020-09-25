import {DeploymentInviteClient} from './deployment-invite-client.interface';
import * as joi from '@hapi/joi';
import {InvalidDeploymentInvite} from './errors/InvalidDeploymentInvite';
import {getDeployment, updateDeployment} from '../deployment/deployment.service';
import * as logger from 'node-logger';
import * as deploymentInviteService from './deployment-invite.service';
import {DeploymentInviteApp} from './deployment-invite-app.interface';
import {DeploymentInviteNotFound} from './errors/DeploymentInviteNotFound';
import {cloneDeep} from 'lodash';
import {DeploymentClient} from '../deployment/deployment-client.class';
import {CannotDowngradeDeploymentLevel} from './errors/CannotDowngradeDeploymentLevel';
import {NoChangeToDeploymentLevel} from './errors/NoChangeToDeploymentLevel';

//-------------------------------------------------
// Create Deployment Invite
//-------------------------------------------------
const createDeploymentSchema = joi.object({
  deploymentId: joi.string().required(),
  deploymentLabel: joi.string().required(),
  level: joi.string().required().valid('admin', 'engineer', 'social', 'basic'),
  expiresIn: joi.number().min(1).max(20160).default(10080), // in minutes
})
.required();

export async function createDeploymentInvite(deploymentInvite: DeploymentInviteClient): Promise<DeploymentInviteClient> {

  const {error: validationError, value: validDeploymentInvite} = createDeploymentSchema.validate(deploymentInvite);
  if (validationError) {
    throw new InvalidDeploymentInvite(validationError.message);
  }

  // Check the deployment actually exists
  await getDeployment(deploymentInvite.deploymentId);

  const deploymentInviteToCreate = deploymentInviteService.deploymentInviteClientToApp(validDeploymentInvite);

  const createdDeployment = await deploymentInviteService.createDeploymentInvite(deploymentInviteToCreate);
  
  logger.debug('New deployment invite created', createdDeployment);

  return deploymentInviteService.deploymentInviteAppToClient(createdDeployment);

}


//-------------------------------------------------
// Get Deployment Invite
//-------------------------------------------------
export async function getDeploymentInvite(id: string): Promise<DeploymentInviteClient> {

  const deploymentInvite: DeploymentInviteApp = await deploymentInviteService.getDeploymentInvite(id);
  logger.debug('Deployment invite found', deploymentInvite);
  return deploymentInviteService.deploymentInviteAppToClient(deploymentInvite);

}


//-------------------------------------------------
// Accept Deployment Invite
//-------------------------------------------------
export async function acceptDeploymentInvite(inviteId: string, userId: string): Promise<DeploymentClient> {

  // Get the invite. Will throw an error if it doesn't exist.
  const deploymentInvite: DeploymentInviteApp = await deploymentInviteService.getDeploymentInvite(inviteId); 

  // In theory deployment invites will be deleted by MongoDB using the TTL feature when they expire, but just in case it fails to do so let's check they haven't expired here too.
  if (deploymentInvite.expiresAt.getTime() < Date.now()) {
    throw new DeploymentInviteNotFound(`Deployment invite ${inviteId} has expired.`);
  }

  // Get the deployment (checks it exists too)
  const deployment = await getDeployment(deploymentInvite.deploymentId);

  // Update the deployment's users array
  const newUsersArray = cloneDeep(deployment.users) || [];
  const idx = newUsersArray.map((user) => user.id).indexOf(userId);
  if (idx === -1) {
    newUsersArray.push({id: userId, level: deploymentInvite.level});
  } else {
    const currentLevel = newUsersArray[idx].level;
    const newLevel = deploymentInvite.level;
    // Worth returning an error if the user already has this level of access.
    if (currentLevel === newLevel) {
      throw new NoChangeToDeploymentLevel(`You already have '${currentLevel}' level access to deployment '${deploymentInvite.deploymentId}'.`);
    }
    // We want to make sure that a user can't accidently downgrade their access level here, otherwise you could easily end up with a deployment that has no admin users.
    if (
      (currentLevel === 'admin' && newLevel !== 'admin') ||
      (currentLevel !== 'basic' && newLevel === 'basic')
    ) {
      throw new CannotDowngradeDeploymentLevel(`Because your current access level to this deployment is '${currentLevel}' and you're trying to accept an invite that would drop your access to '${newLevel}' we cannot permit this because it would be a downgrade.`);
    }
    newUsersArray[idx].level = deploymentInvite.level;
  }
  const updatedDeployment = await updateDeployment(deploymentInvite.deploymentId, {users: newUsersArray});

  // Deployment invites should only grant access to one user each, thus we need to delete it to ensure this.
  await deploymentInviteService.deleteDeploymentInvite(inviteId);

  // Let's return the deployment
  return updatedDeployment;

}