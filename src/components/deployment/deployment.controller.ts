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
      // If the clientId we allocated has already been taken, then lets add a random string onto the end and try again.
      deploymentToCreate.id = `${deploymentToCreate.id}-${generateClientIdSuffix()}`;
      createdDeployment = await deploymentService.createDeployment(deploymentToCreate);
    } else {
      throw err;
    }
  }
  
  logger.debug('New deployment created', createdDeployment);

  // TODO: We need to give the user admin rights to this deployment too. Use the deployment.createdBy field.
  // Need to decide whether to embed the users in the deployment documents, or vice versa, or have a rights collection. 

  return deploymentService.deploymentAppToClient(createdDeployment);

}