import {subscribeToDeploymentEvents} from '../components/deployment/deployment.events';
import {subscribeToPlatformEvents} from '../components/platform/platform.events';
import {subscribeToPermanentHostEvents} from '../components/permanent-host/permanent-host.events';
import {subscribeToRegistrationEvents} from '../components/registration/registration.events';
import {subscribeToSensorEvents} from '../components/sensor/sensor.events';
import {subscribeToContextEvents} from '../components/context/context.events';
import {subscribeToDeploymentUserEvents} from '../components/deployment-user/deployment-user.events';
import {subscribeToUnknownSensorEvents} from '../components/unknown-sensor/unknown-sensor.events';
import {subscribeToProcedureEvents} from '../components/procedure/procedure.events';
import {subscribeToDisciplineEvents} from '../components/discipline/discipline.events';
import {subscribeToAggregationEvents} from '../components/aggregation/aggregation.events';
import {subscribeToObservablePropertyEvents} from '../components/observable-property/observable-property.events';
import {subscribeToUnitEvents} from '../components/unit/unit.events';
import {subscribeToFeatureOfInterestEvents} from '../components/feature-of-interest/feature-of-interest.events';



export async function invokeAllSubscriptions(): Promise<void> {

  await subscribeToDeploymentEvents();
  await subscribeToDeploymentUserEvents();
  await subscribeToPlatformEvents();
  await subscribeToPermanentHostEvents();
  await subscribeToRegistrationEvents();
  await subscribeToSensorEvents();
  await subscribeToContextEvents();
  await subscribeToUnknownSensorEvents();
  await subscribeToProcedureEvents();
  await subscribeToDisciplineEvents();
  await subscribeToObservablePropertyEvents();
  await subscribeToAggregationEvents();
  await subscribeToUnitEvents();
  await subscribeToFeatureOfInterestEvents();

}


