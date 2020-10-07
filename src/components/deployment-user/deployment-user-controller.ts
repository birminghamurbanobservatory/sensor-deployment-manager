import * as logger from 'node-logger';
import * as deploymentService from '../deployment/deployment.service';
import * as deploymentUserService from './deployment-user.service';
import {DeploymentUserClient} from './deployment-user-client.class';
import {DeploymentUserNotFound} from './errors/DeploymentUserNotFound';


export async function getDeploymentUsers(deploymentId: string): Promise<{data: DeploymentUserClient[]; meta: any}> {

  const deployment = await deploymentService.getDeployment(deploymentId);
  logger.debug('Deployment found', deployment);
  const users = deployment.users || [];

  return {
    data: users.map(deploymentUserService.deploymentUserAppToClient),
    meta: {
      count: users.length,
      total: users.length
    }
  } ;

}


export async function getDeploymentUser(deploymentId: string, userId: string): Promise<DeploymentUserClient> {

  const deployment = await deploymentService.getDeployment(deploymentId);
  logger.debug('Deployment found', deployment);
  const users = deployment.users || [];
  const foundUser = users.find((user) => user.id === userId);

  if (!foundUser) {
    throw new DeploymentUserNotFound(`Failed to find a user with id '${userId}' in deployment '${deploymentId}'.`);
  }

  return deploymentUserService.deploymentUserAppToClient(foundUser);

}


export async function getLevelForMultipleDeployments(deploymentIds: string[], userId?: string): Promise<any[]> {

  // Let's get all the deployments (throws an error if a deployment does not exist). 
  const deployments = await deploymentService.getDeploymentsById(deploymentIds);

  const deploymentUsers = deployments.map((deployment) => {

    let level;

    // Is the user listed as a user of this deployment?
    if (userId) {
      const users = deployment.users || [];
      const foundUser = users.find((user) => user.id === userId);
      if (foundUser && foundUser.level) {
        level = foundUser.level;
      }
    }

    // If we didn't find a user specific level, then see if the deployment is public
    if (!level && deployment.public === true) {
      level = 'basic';
    }

    const deploymentUser: any = {
      deploymentId: deployment.id
    };
    if (level) {
      deploymentUser.level = level;
    }

    return deploymentUser;

  });

  return deploymentUsers;

} 



export async function updateDeploymentUser(deploymentId: string, userId: string, updates: {level: string}): Promise<DeploymentUserClient> {

  // TODO

  return;

}


export async function deleteDeploymentUser(deploymentId: string, userId: string): Promise<void> {

  const deployment = await deploymentService.getDeployment(deploymentId);
  logger.debug('Deployment found', deployment);
  const users = deployment.users || [];
  const foundUser = users.find((user) => user.id === userId);

  if (!foundUser) {
    throw new DeploymentUserNotFound(`Failed to find a user with id '${userId}' in deployment '${deploymentId}'.`);
  }

  const newUsersArray = users.filter((user) => {
    return user.id !== userId;
  });

  const updatedDeployment = await deploymentService.updateDeployment(deploymentId, {users: newUsersArray});

  return;

}