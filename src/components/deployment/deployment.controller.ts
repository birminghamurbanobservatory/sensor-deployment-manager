import {DeploymentClient} from './deployment-client.class';
import * as check from 'check-types';
import {labelToClientId} from '../../utils/label-to-client-id';
import {generateClientIdSuffix} from '../../utils/generate-client-id-suffix';
import {DeploymentApp} from './deployment-app.class';
import * as logger from 'node-logger';
import * as deploymentService from './deployment.service';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import * as platformService from '../platform/platform.service';
import * as contextService from '../context/context.service';
import * as sensorService from '../sensor/sensor.service';
import {GetDeploymentsOptions} from './get-deployments-options.class';
import {InvalidDeployment} from './errors/InvalidDeployment';


const createDeploymentSchema = joi.object({
  id: joi.string(),
  label: joi.string().required(),
  description: joi.string().allow(''),
  public: joi.boolean(),
  createdBy: joi.string()
})
.required();

export async function createDeployment(deployment: DeploymentClient): Promise<DeploymentClient> {

  const {error: validationError} = createDeploymentSchema.validate(deployment);
  if (validationError) {
    throw new InvalidDeployment(validationError.message);
  }

  // If the new deployment doesn't have an id yet, then we can autogenerate one.
  const idSpecified = check.assigned(deployment.id);
  if (!idSpecified) {
    deployment.id = labelToClientId(deployment.label);
    logger.debug(`The deployment label: '${deployment.label}' has been converted to an id of '${deployment.id}'`);
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


//-------------------------------------------------
// Get Deployment
//-------------------------------------------------
export async function getDeployment(id: string): Promise<DeploymentClient> {

  const deployment: DeploymentApp = await deploymentService.getDeployment(id);
  logger.debug('Deployment found', deployment);
  return deploymentService.deploymentAppToClient(deployment);

}


//-------------------------------------------------
// Get Deployments
//-------------------------------------------------
const getDeploymentsWhereSchema = joi.object({
  user: joi.string(),
  public: joi.boolean(),
  id: joi.object({
    begins: joi.string(),
    in: joi.array().items(joi.string()).min(1)
  }),
  search: joi.string()
}).required();

const getDeploymentsOptionsSchema = joi.object({
  mineOnly: joi.boolean(),
  limit: joi.number().integer().positive(),
  offset: joi.number().integer().min(0),
  sortBy: joi.string().valid('id'),
  sortOrder: joi.string().valid('asc', 'desc'),
  includeDeleted: joi.boolean()
}).required();

export async function getDeployments(where: {user?: string; public?: boolean; id?: object; search?: string} = {}, options: GetDeploymentsOptions = {}): Promise<{data: DeploymentClient[]; meta: any}> {

  const {error: whereErr, value: validWhere} = getDeploymentsWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid 'where' object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getDeploymentsOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid 'options' object: ${optionsErr.message}`);

  if (validOptions.mineOnly === true && check.not.assigned(validWhere.user)) {
    throw new BadRequest(`It is not possible to set the option 'mineOnly' without the user id being provided in the where object.`);
  }

  const {data: deployments, count, total} = await deploymentService.getDeployments(validWhere, validOptions);
  
  logger.debug(`${deployments.length} deployments found`);
  const deploymentsForClient = deployments.map(deploymentService.deploymentAppToClient);

  return {
    data: deploymentsForClient,
    meta: {
      count,
      total
    }
  };

}


const updateDeploymentSchema = joi.object({
  label: joi.string(),
  description: joi.string().allow(''),
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

  // If a deployment is switched from public to private, we would need to find all platforms in other deployments that were hosted on its platforms and unhost them.
  if (updates.public === false) {

    const {data: deploymentPlatforms} = await platformService.getPlatforms({inDeployment: id});
    const deploymentPlatformIds = deploymentPlatforms.map((platform) => platform.id);

    // Unhost the decendent platforms from other deployments
    await platformService.unhostDescendentPlatformsFromOtherDeployments(id, deploymentPlatformIds);

    // If standalone sensors from other deployments have been hosted on platforms in this deployment then they will need to be unhosted.
    await sensorService.unhostExternalSensorsFromDisappearingDeployment(id, deploymentPlatformIds);

    // Update the corresponding contexts
    await contextService.processDeploymentMadePrivate(id, deploymentPlatformIds);

  }

  return deploymentService.deploymentAppToClient(updatedDeployment);

}


// A soft delete
export async function deleteDeployment(id: string): Promise<void> {

  // Delete the deployment
  await deploymentService.deleteDeployment(id);
  logger.debug(`Deployment '${id}' deleted.`);

  // Get a list of the platforms owned by this platform before deleting them
  const {data: deploymentPlatforms} = await platformService.getPlatforms({inDeployment: id});
  const deploymentPlatformIds = deploymentPlatforms.map((platform) => platform.id);

  // Delete its platforms
  await platformService.deleteDeploymentPlatforms(id);

  if (deploymentPlatformIds.length > 0) {

    // Unhost any platforms in other deployments that were hosted on platforms from this deployment.
    await platformService.unhostPlatformsFromOtherDeployments(id, deploymentPlatformIds);

    // Unhost any sensors from other deployments hosted on this deployments platforms.
    await sensorService.unhostExternalSensorsFromDisappearingDeployment(id, deploymentPlatformIds);

  }

  // Unlink any sensors bound to this deployment.
  await sensorService.removeSensorsFromDeployment(id);
  // TODO: What about the sensors created in this deployment that don't have to permanent hosts, and essentially belong to the deployment. Do these need to be soft deleted? Could do this inside the removeSensorsFromDeploymentFunction, i.e. if any of the sensors being removed don't have a permanentHost then add a deletedAt property.

  // Update the context
  await contextService.processDeploymentDeleted(id, deploymentPlatformIds);

  return;

}