import {add} from 'date-fns';
import {cloneDeep} from 'lodash';
import {DeploymentInviteApp} from './deployment-invite-app.interface';
import {DeploymentInviteClient} from './deployment-invite-client.interface';
import DeploymentInvite from './deployment-invite.model';
import {CreateDeploymentInviteFail} from './errors/CreateDeploymentInviteFail';
import {DeploymentInviteNotFound} from './errors/DeploymentInviteNotFound';
import {GetDeploymentInviteFail} from './errors/GetDeploymentInviteFail';
import {InvalidDeploymentInvite} from './errors/InvalidDeploymentInvite';
import {v4 as uuid} from 'uuid';
import {DeleteDeploymentInviteFail} from './errors/DeleteDeploymentInviteFail';


export async function createDeploymentInvite(deploymentInvite: DeploymentInviteApp): Promise<DeploymentInviteApp> {

  const deploymentInviteDb = deploymentInviteAppToDb(deploymentInvite);

  let createdDeploymentInvite;
  try {
    createdDeploymentInvite = await DeploymentInvite.create(deploymentInviteDb);
  } catch (err) {
    if (err.name === 'ValidationError') {
      throw new InvalidDeploymentInvite(err.message);
    } else {
      throw new CreateDeploymentInviteFail(undefined, err.message);
    }
  }

  return deploymentInviteDbToApp(createdDeploymentInvite);

}



export async function getDeploymentInvite(id: string): Promise<DeploymentInviteApp> {

  let deploymentInvite;
  try {
    deploymentInvite = await DeploymentInvite.findOne(
      {
        _id: id,
      }       
    ).exec();
  } catch (err) {
    throw new GetDeploymentInviteFail(undefined, err.message);
  }

  if (!deploymentInvite) {
    throw new DeploymentInviteNotFound(`A deployment invite with id '${id}' could not be found.`);
  }

  return deploymentInviteDbToApp(deploymentInvite);

}


export async function deleteDeploymentInvite(id: string): Promise<void> {

  let deletedDeploymentInvite;

  try {
    deletedDeploymentInvite = await DeploymentInvite.findByIdAndDelete(id).exec();
  } catch (err) {
    throw new DeleteDeploymentInviteFail(undefined, err.message);
  }

  if (!deletedDeploymentInvite) {
    throw new DeploymentInviteNotFound(`Failed to find a deployment invite with id ${id} and thus could not delete it`);
  }

  return;

}


function deploymentInviteAppToDb(deploymentInviteApp: DeploymentInviteApp): object {
  const deploymentInviteDb: any = cloneDeep(deploymentInviteApp);
  deploymentInviteDb._id = deploymentInviteApp.id;
  delete deploymentInviteDb.id;
  return deploymentInviteDb;
}


function deploymentInviteDbToApp(deploymentInviteDb: any): DeploymentInviteApp {
  const deploymentInviteApp = deploymentInviteDb.toObject();
  deploymentInviteApp.id = deploymentInviteApp._id.toString();
  delete deploymentInviteApp._id;
  delete deploymentInviteApp.__v;
  return deploymentInviteApp;
}


export function deploymentInviteClientToApp(deploymentInviteClient: DeploymentInviteClient): DeploymentInviteApp {
  const deploymentInviteApp: any = cloneDeep(deploymentInviteClient);
  // Convert expiresIn to expiresAt
  deploymentInviteApp.expiresAt = add(new Date(), {minutes: deploymentInviteApp.expiresIn});
  // Give it an id
  deploymentInviteApp.id = uuid();
  delete deploymentInviteApp.expiresIn;
  return deploymentInviteApp; 
}


export function deploymentInviteAppToClient(deploymentInviteApp: DeploymentInviteApp): DeploymentInviteClient {
  const deploymentInviteClient: any = cloneDeep(deploymentInviteApp);
  deploymentInviteClient.expiresAt = deploymentInviteClient.expiresAt.toISOString();
  return deploymentInviteClient;
} 


