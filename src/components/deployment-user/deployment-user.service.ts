import {cloneDeep} from 'lodash';
import {DeploymentUserClient} from './deployment-user-client.class';
import {DeploymentUserApp} from './deployment-user-app.class';


export function deploymentUserAppToClient(deploymentUserApp: DeploymentUserApp): DeploymentUserClient {
  const deploymentUserClient: any = cloneDeep(deploymentUserApp);
  return deploymentUserClient;
}