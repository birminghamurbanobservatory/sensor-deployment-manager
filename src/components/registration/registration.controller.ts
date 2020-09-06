import * as permanentHostService from '../permanent-host/permanent-host.service';
import * as sensorsService from '../sensor/sensor.service';
import * as platformService from '../platform/platform.service';
import * as deploymentService from '../deployment/deployment.service';
import * as contextService from '../context/context.service';
import {generateClientIdSuffix} from '../../utils/generate-client-id-suffix';
import {SensorAlreadyRegistered} from './errors/SensorAlreadyRegistered';
import * as Promise from 'bluebird';
import {ContextApp} from '../context/context-app.class';
import * as logger from 'node-logger';
import {PlatformClient} from '../platform/platform-client.class';
import {PermanentHostAlreadyRegistered} from '../permanent-host/errors/PermanentHostAlreadyRegistered';
import * as check from 'check-types';


export async function register(registrationKey, deploymentId): Promise<PlatformClient> {

  // I may eventually allow individual sensors to have their own registration key, i.e. rather than always having sensors on a permanentHost. In which case I'd also need to check the sensors collection for registration keys. N.B. that if you do this you'll need to keep the registration keys unique across both collections, e.g by adding an 's' on the end of registration keys for sensors and making it 11 characters long.

  logger.debug(`About to use registration key '${registrationKey}' on deployment '${deploymentId}'.`);

  // Get the permanent host with this registration key (errors if it can't be found)
  const permanentHost = await permanentHostService.getPermanentHostByRegistrationKey(registrationKey);

  if (permanentHost.registeredAs) {
    throw new PermanentHostAlreadyRegistered(`This permament host is already registered as platform '${permanentHost.registeredAs}.'`);
  }

  // Get the deployment (errors if it can't be found)
  await deploymentService.getDeployment(deploymentId);

  // Get all the sensors with this permanent host
  const {data: sensors} = await sensorsService.getSensors({permanentHost: permanentHost.id});
  // If any of these sensors are already bound to another deployment then the user is not allowed to move them to their own deployment.
  sensors.forEach((sensor) => {
    if (sensor.hasDeployment) {
      throw new SensorAlreadyRegistered(`Sensor(s) are already registered to the '${sensor.hasDeployment}' deployment.`);
    }
  });

  // Create a new platform in the deployment based on this permanentHost
  const platformToCreate: any = {
    id: `${permanentHost.id}-${generateClientIdSuffix()}`,
    label: permanentHost.label,
    description: permanentHost.description,
    inDeployment: deploymentId,
    static: permanentHost.static,
    initialisedFrom: permanentHost.id
  };
  if (permanentHost.updateLocationWithSensor) {
    platformToCreate.updateLocationWithSensor = permanentHost.updateLocationWithSensor;
  }
  if (check.assigned(permanentHost.passLocationToObservations)) {
    platformToCreate.passLocationToObservations = permanentHost.passLocationToObservations;
  }
  const platform = await platformService.createPlatform(platformToCreate);
  logger.debug(`A new platform has been created using the permanentHost ${permanentHost.id} as a basis.`, platform);

  // Update all these sensors so that they're now in this deployment and on this new platform.
  const updatedSensors = await Promise.map(sensors, async (sensor) => {
    return await sensorsService.updateSensor(sensor.id, {
      hasDeployment: deploymentId,
      isHostedBy: platform.id
    });
  });
  logger.debug('Sensors have been updated', updatedSensors);

  // Now to update the context for each of these sensors
  const transitionDate = new Date();
  const newLiveContexts = await Promise.map(updatedSensors, async (sensor) => {
    // End the current context
    await contextService.endLiveContextForSensor(sensor.id, transitionDate);
    // Create a new context
    const newContext: ContextApp = {
      sensor: sensor.id,
      startDate: transitionDate,
      hasDeployment: sensor.hasDeployment,
      hostedByPath: [sensor.isHostedBy],
      config: sensor.initialConfig || []
    };
    return await contextService.createContext(newContext);
  });
  logger.debug('New live contexts have been created', newLiveContexts);

  // Update the permanentHost so we know it is registered
  await permanentHostService.updatePermanentHostRegisteredAs(permanentHost.id, platform.id);

  logger.debug(`Successfully used registration key '${registrationKey}' on deployment '${deploymentId}' and in so doing so updated ${updatedSensors.length} sensor(s) and their context.`);

  const platformForClient = platformService.platformAppToClient(platform);
  return platformForClient;

}