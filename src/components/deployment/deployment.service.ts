import {DeploymentClient} from './deployment-client.class';
import {InvalidDeployment} from './errors/InvalidDeployment';
import {CreateDeploymentFail} from './errors/CreateDeploymentFail';
import {DeploymentAlreadyExists} from './errors/DeploymentAlreadyExists';
import Deployment from './deployment.model';
import {cloneDeep, difference, pick, omit} from 'lodash';
import {DeploymentApp} from './deployment-app.class';
import {GetDeploymentsFail} from './errors/GetDeploymentsFail';
import {GetDeploymentFail} from './errors/GetDeploymentFail';
import * as check from 'check-types';
import {DeploymentNotFound} from './errors/DeploymentNotFound';
import {UpdateDeploymentFail} from './errors/UpdateDeploymentFail';
import {DeleteDeploymentFail} from './errors/DeleteDeploymentFail';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';
import {PaginationOptions} from '../common/pagination-options.class';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import {GetDeploymentsOptions} from './get-deployments-options.class';


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
    deployment = await Deployment.findOne(
      {
        _id: id,
        deletedAt: {$exists: false}
      }       
    ).exec();
  } catch (err) {
    throw new GetDeploymentFail(undefined, err.message);
  }

  // Will need to think if we ever need to get a deleted deployment, and if so how to handle this, e.g. at which level: service, controller or api gateway?
  if (!deployment || deployment.deletedAt) {
    throw new DeploymentNotFound(`A deployment with id '${id}' could not be found`);
  }

  return deploymentDbToApp(deployment);

}



export async function getDeployments(
  where: {user?: string; public?: boolean; id: object; search?: string}, 
  options: GetDeploymentsOptions = {}
): Promise<{data: DeploymentApp[]; count: number; total: number}> {

  const whereWithUserProperty = omit(where, 'user');
  const wherePart = whereToMongoFind(whereWithUserProperty);

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);

  // I'm a little paranoid that I'll come to use this at some point to get a user's deployments and not expect other public deployments to be included, so I'll default mineOnly to true.
  if (check.not.assigned(options.mineOnly)) {
    options.mineOnly = true;
  }
  
  // - So superusers wanting everything wouldn't provide a user property in the where object or mineOnly in the options.
  // - A standard authenticated user wanting their deployments and public deployments would provide their user id, and would set mineOnly to false.
  // A standard user want just theirs would provide their user id and also set mineOnly to true 
  const userPart: any = {};
  if (check.assigned(where.user)) {
    if (options.mineOnly === true) {
      userPart['users._id'] = where.user;
    } else {
      userPart.$or = [{'users._id': where.user}, {public: true}];
    }
  }

  const findWhere = Object.assign(
    wherePart,
    userPart,
    {deletedAt: {$exists: false}}
  );

  let deployments;
  try {
    deployments = await Deployment.find(findWhere, null, findOptions).exec();
  } catch (err) {
    throw new GetDeploymentsFail(undefined, err.message);
  }

  const count = deployments.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await Deployment.countDocuments(findWhere);
    }
  } else {
    total = count;
  }

  const deploymentsForApp = deployments.map(deploymentDbToApp);

  return {
    data: deploymentsForApp,
    count,
    total
  };

}



export async function getDeploymentsById(deploymentIds: string[]): Promise<DeploymentApp[]> {

  let foundDocs;

  try {
    foundDocs = Deployment.find({_id: {$in: deploymentIds}}).exec();
  } catch (err) {
    throw new GetDeploymentsFail(undefined, err.message);
  }

  const foundDeployments = foundDocs.map(deploymentDbToApp);
  const foundDeploymentIds = foundDeployments.map((deployment) => deployment.id);

  // Throws an error if we weren't able to find any of them.
  const unfoundIds = difference(foundDeploymentIds, deploymentIds);
  if (unfoundIds.length > 0) {
    throw new DeploymentNotFound(`Unable to find the following deployments: ${unfoundIds.join()}.`);
  }

  return foundDeployments;

}



export async function updateDeployment(id: string, updates: any): Promise<DeploymentApp> {

  let updatedDeployment;
  try {
    updatedDeployment = await Deployment.findOneAndUpdate(
      {
        _id: id,
        deletedAt: {$exists: false}
      }, 
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
    deletedDeployment = await Deployment.findOneAndUpdate(
      {
        _id: id,
        deletedAt: {$exists: false}
      }, 
      updates,
      {
        new: true,
        runValidators: true
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
  if (deploymentDb.users) {
    deploymentDb.users = deploymentDb.users.map((user) => {
      user._id = user.id;
      delete user.id;
      return user;
    });
  }
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
  deploymentClient.createdAt = deploymentClient.createdAt.toISOString();
  deploymentClient.updatedAt = deploymentClient.updatedAt.toISOString();
  return deploymentClient;
} 


export function deploymentClientToApp(deploymentClient: DeploymentClient): DeploymentApp {
  const deploymentApp: any = cloneDeep(deploymentClient);
  return deploymentApp; 
}