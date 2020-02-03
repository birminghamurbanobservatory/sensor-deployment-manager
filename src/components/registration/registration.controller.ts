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


export async function register(registrationKey, deploymentId): Promise<PlatformClient> {

  // I may eventually allow individual sensors to have their own registration key, i.e. rather than always having sensors on a permanentHost. In which case I'd also need to check the sensors collection for registration keys. N.B. that if you do this you'll need to keep the registration keys unique across both collections, e.g by adding an 's' on the end of registration keys for sensors and making it 11 characters long.

  logger.debug(`About to use registration key '${registrationKey}' on deployment '${deploymentId}'.`);

  // Get the permanent host with this registration key (errors if it can't be found)
  const permanentHost = await permanentHostService.getPermanentHostByRegistrationKey(registrationKey);

  // TODO: Need to make sure that this registration key can't be used be anyone else once it has been used to create a platform in this deployment. Two choices:
  // 1. Add a check here to make sure there's no platform (excluding deleting ones) that has a initialisedFrom property equal to this permanent host.
  // 2. Once this registration key has been used generate a new one.

  // Get the deployment (errors if it can't be found)
  await deploymentService.getDeployment(deploymentId);

  // Get all the sensors with this permanent host
  const sensors = await sensorsService.getSensors({permanentHost: permanentHost.id});
  // If any of these sensors are already bound to another deployment then the user is not allowed to move them to their own deployment.
  sensors.forEach((sensor) => {
    if (sensor.inDeployment) {
      throw new SensorAlreadyRegistered(`Sensor(s) are already registered to the '${sensor.inDeployment}' deployment.`);
    }
  });

  // Create a new platform in the deployment based on this permanentHost
  const platformToCreate = {
    id: `${permanentHost.id}-${generateClientIdSuffix()}`,
    name: permanentHost.name,
    description: permanentHost.description,
    ownerDeployment: deploymentId,
    inDeployments: [deploymentId],
    static: permanentHost.static,
    initialisedFrom: permanentHost.id,
    updateLocationWithSensor: permanentHost.updateLocationWithSensor
  };
  if (permanentHost.updateLocationWithSensor) {
    platformToCreate.updateLocationWithSensor = permanentHost.updateLocationWithSensor;
  }
  const platform = await platformService.createPlatform(platformToCreate);
  logger.debug(`A new platform has been created using the permanentHost ${permanentHost.id} as a basis.`, platform);

  // Update all these sensors so that they're now in this deployment and on this new platform.
  const updatedSensors = await Promise.map(sensors, async (sensor) => {
    return await sensorsService.updateSensor(sensor.id, {
      inDeployment: deploymentId,
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
      toAdd: {
        inDeployments: [sensor.inDeployment], 
        hostedByPath: [sensor.isHostedBy]
      }
    };
    if (sensor.defaults) {
      newContext.toAdd = Object.assign({}, newContext.toAdd, sensor.defaults);
    }
    return await contextService.createContext(newContext);
  });
  logger.debug('New live contexts have been created', newLiveContexts);

  logger.debug(`Successfully used registration key '${registrationKey}' on deployment '${deploymentId}' and in so doing so updated ${updatedSensors.length} sensor(s) and their context.`);

  const platformForClient = platformService.platformAppToClient(platform);
  return platformForClient;

}