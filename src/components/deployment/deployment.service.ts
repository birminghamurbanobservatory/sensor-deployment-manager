import {DeploymentClient} from './deployment-client.class';
import {InvalidDeployment} from './errors/InvalidDeployment';
import {CreateDeploymentFail} from './errors/CreateDeploymentFail';
import {DeploymentAlreadyExists} from './errors/DeploymentAlreadyExists';
import Deployment from './deployment.model';
import {cloneDeep} from 'lodash';
import {DeploymentApp} from './deployment-app.class';
import {GetDeploymentsFail} from './errors/GetDeploymentsFail';
import * as check from 'check-types';



export async function createDeployment(deployment: DeploymentApp): Promise<DeploymentApp> {

  const deploymentDb = deploymentAppToDb(deployment);

  let createdDeployment;
  try {
    createdDeployment = await Deployment.create(deploymentDb);
  } catch (err) {
    console.log(err);
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


export async function getDeployments(where: {user?: string; public?: boolean}): Promise<DeploymentApp[]> {

  const findWhere = Object.assign({});
  if (check.assigned(where.public)) {
    findWhere.public = where.public;
  }
  if (check.assigned(where.user)) {
    findWhere['users._id'] = where.user;
  }

  console.log('findWhere');
  console.log(findWhere);

  let deployments;
  try {
    deployments = await Deployment.find(findWhere).exec();
  } catch (err) {
    throw new GetDeploymentsFail(undefined, err.message);
  }

  return deployments.map(deploymentDbToApp);

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
  deploymentApp.id = deploymentApp._id;
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