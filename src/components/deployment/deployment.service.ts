import {DeploymentClient} from './deployment-client.class';
import {InvalidDeployment} from './errors/InvalidDeployment';
import {CreateDeploymentFail} from './errors/CreateDeploymentFail';
import {DeploymentAlreadyExists} from './errors/DeploymentAlreadyExists';
import Deployment from './deployment.model';
import {cloneDeep} from 'lodash';
import {DeploymentApp} from './deployment-app.class';
import {GetDeploymentsFail} from './errors/GetDeploymentsFail';
import {GetDeploymentFail} from './errors/GetDeploymentFail';
import * as check from 'check-types';
import {DeploymentNotFound} from './errors/DeploymentNotFound';
import {UpdateDeploymentFail} from './errors/UpdateDeploymentFail';
import {DeleteDeploymentFail} from './errors/DeleteDeploymentFail';



export async function createDeployment(deployment: DeploymentApp): Promise<DeploymentApp> {

  const deploymentDb = deploymentAppToDb(deployment);

  let createdDeployment;
  try {
    createdDeployment = await Deployment.create(deploymentDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new DeploymentAlreadyExists(`A deployment with an id of ${deployment.id} already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidDeployment(err.message);
    } else {
      throw new CreateDeploymentFail(undefined, err.message);
    }
  }

  return deploymentDbToApp(createdDeployment);

}


export async function getDeployment(id: string): Promise<DeploymentApp> {

  let deployment;
  try {
    deployment = await Deployment.findById(id).exec();
  } catch (err) {
    throw new GetDeploymentFail(undefined, err.message);
  }

  if (!deployment) {
    throw new DeploymentNotFound(`A deployment with id '${id}' could not be found`);
  }

  return deploymentDbToApp(deployment);

}



export async function getDeployments(where: {user?: string; public?: boolean}): Promise<DeploymentApp[]> {

  // Exclude deleted deployments.
  const findWhere: any = {
    deletedAt: {$exists: false}
  };
  if (check.assigned(where.public)) {
    findWhere.public = where.public;
  }
  if (check.assigned(where.user)) {
    findWhere['users._id'] = where.user;
  }

  let deployments;
  try {
    deployments = await Deployment.find(findWhere).exec();
  } catch (err) {
    throw new GetDeploymentsFail(undefined, err.message);
  }

  return deployments.map(deploymentDbToApp);

}




export async function updateDeployment(id: string, updates: any): Promise<DeploymentApp> {

  let updatedDeployment;
  try {
    updatedDeployment = await Deployment.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new UpdateDeploymentFail(undefined, err.message);
  }

  if (!updatedDeployment) {
    throw new DeploymentNotFound(`A deployment with id '${id}' could not be found`);
  }

  return deploymentDbToApp(updatedDeployment);

}



// A soft delete
export async function deleteDeployment(id: string): Promise<void> {

  const updates = {
    users: [],
    deletedAt: new Date()
  };

  let deletedDeployment;
  try {
    deletedDeployment = await Deployment.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
      }
    ).exec();
  } catch (err) {
    throw new DeleteDeploymentFail(`Failed to delete deployment '${id}'`, err.message);
  }

  if (!deletedDeployment) {
    throw new DeploymentNotFound(`A deployment with id '${id}' could not be found`);
  }

  return;

}





function deploymentAppToDb(deploymentApp: DeploymentApp): object {
  const deploymentDb: any = cloneDeep(deploymentApp);
  deploymentDb._id = deploymentApp.id;
  delete deploymentDb.id;
  deploymentDb.users = deploymentDb.users.map((user) => {
    user._id = user.id;
    delete user.id;
    return user;
  });
  return deploymentDb;
}


function deploymentDbToApp(deploymentDb: any): DeploymentApp {
  const deploymentApp = deploymentDb.toObject();
  deploymentApp.id = deploymentApp._id.toString();
  delete deploymentApp._id;
  delete deploymentApp.__v;
  deploymentApp.users = deploymentApp.users.map((user) => {
    user.id = user._id;
    delete user._id;
    return user;
  });  
  return deploymentApp;
}


export function deploymentAppToClient(deploymentApp: DeploymentApp): DeploymentClient {
  const deploymentClient: any = cloneDeep(deploymentApp);
  return deploymentClient;
} 


export function deploymentClientToApp(deploymentClient: DeploymentClient): DeploymentApp {
  const deploymentApp: any = cloneDeep(deploymentClient);
  return deploymentApp; 
}