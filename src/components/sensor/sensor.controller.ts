import {SensorClient} from './sensor-client.class';
import {SensorApp} from './sensor-app.class';
import * as logger from 'node-logger';
import * as sensorService from './sensor.service';
import * as permanentHostService from '../permanent-host/permanent-host.service';
import * as contextService from '../context/context.service';
import {ContextApp} from '../context/context-app.class';
import * as joi from '@hapi/joi';
import {InvalidSensor} from './errors/InvalidSensor';
import * as check from 'check-types';
import {BadRequest} from '../../errors/BadRequest';


const newSensorSchema = joi.object({
  id: joi.string() // we'll leave the model schema to check the length
    .required(),
  name: joi.string(),
  description: joi.string(),
  permanentHost: joi.string(),
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

  logger.debug('Creating new sensor');

  // Well worth having some validation here to ensure the code below works ok.
  const {error: err} = newSensorSchema.validate(sensor);
  if (err) {
    throw new InvalidSensor(err.message);
  }

  // Begin to create the context for this sensor.
  const context: ContextApp = {
    sensor: sensor.id,
    startDate: new Date(),
    toAdd: {}
  };

  // Have any defaults been set for the sensor that should be used in the context.
  if (sensor.defaults) {
    context.toAdd = sensor.defaults;
  }

  // Check the permanent host exists if provided
  if (sensor.permanentHost) {
    await permanentHostService.getPermanentHost(sensor.permanentHost);
  }  

  const createdContext = await contextService.createContext(context);
  logger.debug('Context created for new sensor', createdContext);


  const sensorToCreate: SensorApp = sensorService.sensorClientToApp(sensor);
  const createdSensor: SensorApp = await sensorService.createSensor(sensorToCreate);
  logger.debug('New sensor created', createdSensor);

  return sensorService.sensorAppToClient(createdSensor);

}



export async function getSensor(id: string): Promise<SensorClient> {

  const sensor: SensorApp = await sensorService.getSensor(id);
  logger.debug('Sensor found', sensor);
  return sensorService.sensorAppToClient(sensor);

}



const sensorUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  name: joi.string(),
  description: joi.string(),
  permanentHost: joi.string().allow(null),
  defaults: joi.object({})
    .allow(null)
    .unknown()  
})
.min(1)
.required(); 

// When it comes to adding/removing sensors to platforms and deployments, this is handled elsewhere, e.g. via registration keys.
export async function updateSensor(id: string, updates: any): Promise<SensorClient> {

  logger.debug(`Updating sensor '${id}'`);

  // First let's get the current sensor details
  const oldSensor = await sensorService.getSensor(id);

  const {error: validationErr} = sensorUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  const permanentHostChange = check.containsKey(updates, 'permanentHost') && 
    oldSensor.permanentHost !== updates.permanentHost &&
    !(!oldSensor.permanentHost && updates.permanentHost === null);

  const defaultsChange = check.containsKey(updates, 'defaultsChange');

  // Only allow the user to update the permanentHost when the sensor is currently unassigned to a deployment or platform.
  if (permanentHostChange && (oldSensor.inDeployment)) {
    throw new BadRequest(`The sensor is still in the '${oldSensor.inDeployment}' deployment. Please remove it from this deployment before changing the permanent host`);
  }
  if (permanentHostChange && (oldSensor.isHostedBy)) {
    throw new BadRequest(`The sensor is still hosted by the '${oldSensor.isHostedBy}' platform. Please remove it from this platform before changing the permanent host`);
  }

  if (updates.permanentHost) {
    // Check this permanent host exists
    await permanentHostService.getPermanentHost(updates.permanentHost);
  }

  const updatedSensor = await sensorService.updateSensor(id, updates);
  logger.debug(`Sensor '${id}' updated.`);

  // If the sensor isn't in a deployment then changes to its defaults should also update its context
  if (!oldSensor.inDeployment && defaultsChange) {

    logger.debug(`Context for sensor ${id} needs updating.`);
    
    // End current context
    const transitionDate = new Date();
    await contextService.endLiveContextForSensor(id, transitionDate);
    
    // Create new context
    const newContext: ContextApp = {
      sensor: id,
      startDate: transitionDate,
      toAdd: updatedSensor.defaults || {}
    };

    // Create the new context
    const createdContext = await contextService.createContext(newContext);
    logger.debug(`New context for sensor ${id}.`, createdContext);

  }

  return sensorService.sensorAppToClient(updatedSensor);

}


