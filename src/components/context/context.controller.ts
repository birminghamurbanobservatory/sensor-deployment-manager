import * as contextService from './context.service';
import * as sensorService from '../sensor/sensor.service';


// TODO: Should I move this to context.service? Sensor defaults will need to be a function argument.
export async function processSensorRemovedFromDeployment(sensorId: string): Promise<void> {

  const transitionDate = new Date();

  // End the current context
  await contextService.endLiveContextForSensor(sensorId, transitionDate);

  // When a sensor leaves a deployment the context is created from scratch again using any sensor defaults.
  const sensor = await sensorService.getSensor(sensorId);

  let newContext = {
    sensor: sensorId,
    startDate: transitionDate
  };

  if (sensor.defaults) {
    newContext = Object.assign(newContext, sensor.defaults);
  }

  // Create the new context
  await contextService.createContext(newContext);

}
