import {DeploymentClient} from './deployment-client.class';
import * as check from 'check-types';
import {nameToClientId} from '../../utils/name-to-client-id';
import {generateClientIdSuffix} from '../../utils/generate-client-id-suffix';
import {DeploymentApp} from './deployment-app.class';
import * as logger from 'node-logger';
import * as deploymentService from './deployment.service';


export async function createDeployment(deployment: DeploymentClient): Promise<DeploymentClient> {

  // If the new deployment doesn't have an id yet, then we can autogenerate one.
  const idSpecified = check.assigned(deployment.id);
  if (!idSpecified) {
    deployment.id = nameToClientId(deployment.name);
    logger.debug(`The deployment name: '${deployment.name}' has been converted to an id of '${deployment.id}'`);
  }

  const deploymentToCreate: DeploymentApp = deploymentService.deploymentClientToApp(deployment);

  let createdDeployment: DeploymentApp;
  try {
    createdDeployment = await deploymentService.createDeployment(deploymentToCreate);
  } catch (err) {
    if (!idSpecified && err.name === 'DeploymentAlreadyExists') {
      // If the id we allocated is already taken then add a random string on the end and try again.
      deploymentToCreate.id = `${deploymentToCreate.id}-${generateClientIdSuffix()}`;
      createdDeployment = await deploymentService.createDeployment(deploymentToCreate);
    } else {
      throw err;
    }
  }
  
  logger.debug('New deployment created', createdDeployment);

  return deploymentService.deploymentAppToClient(createdDeployment);

}


export async function getDeployment(id: string): Promise<DeploymentClient> {

  const deployment: DeploymentApp = await deploymentService.getDeployment(id);
  logger.debug('Deployment found', deployment);
  return deploymentService.deploymentAppToClient(deployment);

}


export async function getDeployments(where: {user?: string; public?: boolean}): Promise<DeploymentClient[]> {

  const deployments: DeploymentApp[] = await deploymentService.getDeployments(where);
  
  logger.debug('Deployments found', deployments);
  return deployments.map(deploymentService.deploymentAppToClient);

}



export async function updateDeployment(id: string, updates: any): Promise<DeploymentClient> {

  // TODO: we need a quick check to make sure only certain fields are being updated.
  // TODO: If a deployment is switched from public to private, we would need to find all platforms in other deployments that were hosted on its platforms and unhost them (unless they were shared with the deployment, in which case the deployment would be listed in the hostee platform's inDeployments array).

  const updatedDeployment = await deploymentService.updateDeployment(id, updates);
  logger.debug(`Deployment '${id}' updated.`);
  return deploymentService.deploymentAppToClient(updatedDeployment);

}



export async function deleteDeployment(id: string): Promise<void> {
  await deploymentService.deleteDeployment(id);
  logger.debug(`Deployment '${id}' deleted.`);
  // TODO: Is there anything that belongs to the deployment that needs updating? 
  // E.g. 
  // Delete all platforms owned by this deployment?
  // Unlink any sensors bound to this deployment, and update their context.
  // Unhost any platforms in other deployments that were hosted on platforms from this deployment.
  return;
}