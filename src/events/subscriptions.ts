import {subscribeToDeploymentEvents} from '../components/deployment/deployment.events';
import {subscribeToPlatformEvents} from '../components/platform/platform.events';
import {subscribeToPermanentHostEvents} from '../components/permanent-host/permanent-host.events';
import {subscribeToRegistrationEvents} from '../components/registration/registration.events';
import {subscribeToSensorEvents} from '../components/sensor/sensor.events';
import {subscribeToContextEvents} from '../components/context/context.events';



export async function invokeAllSubscriptions(): Promise<void> {

  await subscribeToDeploymentEvents();
  await subscribeToPlatformEvents();
  await subscribeToPermanentHostEvents();
  await subscribeToRegistrationEvents();
  await subscribeToSensorEvents();
  await subscribeToContextEvents();

}


