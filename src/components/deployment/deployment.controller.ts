import {DeploymentClient} from './deployment-client.class';
import * as check from 'check-types';
import {nameToClientId} from '../../utils/name-to-client-id';
import {generateClientIdSuffix} from '../../utils/generate-client-id-suffix';
import {DeploymentApp} from './deployment-app.class';
import * as logger from 'node-logger';
import * as deploymentService from './deployment.service';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import * as platformService from '../platform/platform.service';
import * as contextService from '../context/context.service';
import * as sensorService from '../sensor/sensor.service';



export async function createDeployment(deployment: DeploymentClient): Promise<DeploymentClient> {

  // If the new deployment doesn't have an id yet, then we can autogenerate one.
  const idSpecified = check.assigned(deployment.id);
  if (!idSpecified) {
    deployment.id = nameToClientId(deployment.name);
    logger.debug(`The deployment name: '${deployment.name}' has been converted to an id of '${deployment.id}'`);
  }

  const deploymentToCreate: DeploymentApp = deploymentService.deploymentClientToApp(deployment);

  if (deploymentToCreate.createdBy && !deploymentToCreate.users) {
    deploymentToCreate.users = [{id: deploymentToCreate.createdBy, level: 'admin'}];
  }

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


const updateDeploymentSchema = joi.object({
  name: joi.string(),
  description: joi.string(),
  public: joi.boolean()
})
.required();

export async function updateDeployment(id: string, updates: any): Promise<DeploymentClient> {

  const {error: validationError} = updateDeploymentSchema.validate(updates);
  if (validationError) {
    throw new BadRequest(validationError.message);
  }

  const updatedDeployment = await deploymentService.updateDeployment(id, updates);
  logger.debug(`Deployment '${id}' updated.`);

  // If a deployment is switched from public to private, we would need to find all platforms in other deployments that were hosted on its platforms and unhost them (unless they were shared with the deployment).
  if (updates.public === false) {

    const deploymentPlatforms = await platformService.getPlatforms({ownerDeployment: id});
    const deploymentPlatformIds = deploymentPlatforms.map((platform) => platform.id);

    // Unhost the decendent platforms from non-shared deployments
    await platformService.unhostDescendentPlatformsFromNonSharedDeployments(id, deploymentPlatformIds);
    // Update the corresponding contexts
    await contextService.processDeploymentMadePrivate(id, deploymentPlatformIds);

    // TODO: If I ever allow a sensor to be hosted directly on a platform from another deployment (i.e. without a platform in the sensors deployment in between) then I would need to look for sensors with an isHostedBy property equal to any of platforms being turning private and remove the isHostedBy field so the sensor is left unhosted.
  
  }

  return deploymentService.deploymentAppToClient(updatedDeployment);

}



export async function deleteDeployment(id: string): Promise<void> {

  // Delete the deployment
  await deploymentService.deleteDeployment(id);
  logger.debug(`Deployment '${id}' deleted.`);

  // Get a list of the platforms owned by this platform before deleting them
  const deploymentPlatforms = await platformService.getPlatforms({ownerDeployment: id});
  const deploymentPlatformIds = deploymentPlatforms.map((platform) => platform.id);

  // Delete its platforms
  // If a sharee deployment wants to still see this platfrom then the original deployment would need to have transferred ownership to the sharee deployment before deleting the deployment.
  await platformService.deleteDeploymentPlatforms(id);

  // If any platforms from other deployments have be shared with this deployment then we'll want to unshare them.
  await platformService.unsharePlatformsSharedWithDeployment(id);

  // Unhost any platforms in other deployments that were hosted on platforms from this deployment.
  await platformService.unhostPlatformsFromOtherDeployments(id, deploymentPlatformIds);

  // Unlink any sensors bound to this deployment.
  await sensorService.removeSensorsFromDeployment(id);

  // Update the context
  await contextService.processDeploymentDeleted(id, deploymentPlatformIds);

  return;

}