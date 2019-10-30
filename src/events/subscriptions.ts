import {subscribeToDeploymentEvents} from '../components/deployment/deployment.events';


export async function invokeAllSubscriptions(): Promise<void> {

  await subscribeToDeploymentEvents();

}


