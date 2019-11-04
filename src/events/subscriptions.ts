import {subscribeToDeploymentEvents} from '../components/deployment/deployment.events';
import {subscribeToPlatformEvents} from '../components/platform/platform.events';



export async function invokeAllSubscriptions(): Promise<void> {

  await subscribeToDeploymentEvents();
  await subscribeToPlatformEvents();

}


