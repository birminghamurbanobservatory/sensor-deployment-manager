import {SensorClient} from './sensor-client.class';
import {SensorApp} from './sensor-app.class';
import * as logger from 'node-logger';
import * as sensorService from './sensor.service';
import * as deploymentService from '../deployment/deployment.service';
import * as platformService from '../platform/platform.service';
import * as permanentHostService from '../permanent-host/permanent-host.service';
import * as contextService from '../context/context.service';
import {ContextApp} from '../context/context-app.class';
import * as joi from '@hapi/joi';
import {InvalidSensor} from './errors/InvalidSensor';
import {PlatformApp} from '../platform/platform-app.class';
import * as check from 'check-types';
import {uniq, concat} from 'lodash';


const newSensorSchema = joi.object({
  id: joi.string() // we'll leave the model schema to check the length
    .required(),
  name: joi.string(),
  description: joi.string(),
  inDeployment: joi.string(),
  permanentHost: joi.string(),
  isHostedBy: joi.string(),
  defaults: joi.object({
    observedProperty: joi.object({
      value: joi.string()
    }),
    hasFeatureOfInterest: joi.object({
      value: joi.string()
    }),
    usedProcedure: joi.object({
      value: joi.array().items(joi.string())
    })
  }) 
})
.with('permanentHost', 'inDeployment')
.required();


export async function createSensor(sensor: SensorClient): Promise<SensorClient> {

  // Well worth having some validation here to ensure the code below works ok.
  const {error: err} = newSensorSchema.validate(sensor);
  if (err) {
    throw new InvalidSensor(err.message);
  }

  // Begint to create the context for this sensor.
  const context: ContextApp = {
    sensor: sensor.id,
    startDate: new Date()
  };

  // If the user is trying to add the sensor straight to a deployment on creation then check this deployment exists.
  if (sensor.inDeployment) {
    await deploymentService.getDeployment(sensor.inDeployment);
    context.toAdd.inDeployments = {value: [sensor.inDeployment]};
  }

  // Check the platform exists if provided
  if (sensor.isHostedBy) {
    const platform: PlatformApp = await platformService.getPlatform(sensor.isHostedBy);
    // Check this platform is in the deployment provided for the sensor
    if (!platform.inDeployments || !platform.inDeployments.includes(sensor.inDeployment)) {
      throw new InvalidSensor(`The platform '${sensor.isHostedBy}' provided via the isHostedBy property does not belong to the deployment '${sensor.inDeployment}' provided via the inDeployment field.`);
    }
    // If the platform belongs to extra deployments then add these to the context too.
    if (check.nonEmptyArray(platform.inDeployments)) {
      context.toAdd.inDeployments = {value: uniq(concat(sensor.inDeployment, platform.inDeployments))};
    } 
    // Set the hostedByPath for the context
    let hostedByPath = [platform.id];
    if (check.nonEmptyArray(platform.hostedByPath)) {
      hostedByPath = concat(platform.hostedByPath, hostedByPath);
    }
    context.toAdd.hostedByPath = {value: hostedByPath};
  }  

  // Check the permanent host exists if provided
  if (sensor.permanentHost) {
    await permanentHostService.getPermanentHost(sensor.permanentHost);
  }  

  await contextService.createContext(context);

  const sensorToCreate: SensorApp = sensorService.sensorClientToApp(sensor);
  const createdSensor: SensorApp = await sensorService.createSensor(sensorToCreate);  
  logger.debug('New sensor created', createdSensor);

  return sensorService.sensorAppToClient(createdSensor);

}

