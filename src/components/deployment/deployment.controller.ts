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

  // Add the user creating the deployment to the users array
  deploymentToCreate.users = [
    {
      id: deploymentToCreate.createdBy,
      level: 'admin'
    }
  ];

  let createdDeployment: DeploymentApp;
  try {
    createdDeployment = await deploymentService.createDeployment(deploymentToCreate);
  } catch (err) {
    if (!idSpecified && err.name === 'DeploymentAlreadyExists') {
      // If the clientId we allocated has already been taken, then lets add a random string onto the end and try again.
      deploymentToCreate.id = `${deploymentToCreate.id}-${generateClientIdSuffix()}`;
      createdDeployment = await deploymentService.createDeployment(deploymentToCreate);
    } else {
      throw err;
    }
  }
  
  logger.debug('New deployment created', createdDeployment);

  return deploymentService.deploymentAppToClient(createdDeployment);

}



export async function getDeployments(where: {user?: string; public?: boolean}): Promise<DeploymentClient[]> {

  const deployments: DeploymentApp[] = await deploymentService.getDeployments(where);
  
  logger.debug('Deployments found', deployments);
  return deployments.map(deploymentService.deploymentAppToClient);

}