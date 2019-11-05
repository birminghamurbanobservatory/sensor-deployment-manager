import {subscribeToDeploymentEvents} from '../components/deployment/deployment.events';
import {subscribeToPlatformEvents} from '../components/platform/platform.events';
import {subscribeToPermanentHostEvents} from '../components/permanent-host/permanent-host.events';



export async function invokeAllSubscriptions(): Promise<void> {

  await subscribeToDeploymentEvents();
  await subscribeToPlatformEvents();
  await subscribeToPermanentHostEvents();

}


