import * as unknownSensorService from './unknown-sensor.service';
import {UnknownSensorClient} from './unknown-sensor-client.class';


export async function getUnknownSensors(): Promise<UnknownSensorClient[]> {

  const unknownSensors = await unknownSensorService.getUnknownSensors();
  const unknownSensorsForClient = unknownSensors.map(unknownSensorService.unknownSensorAppToClient);
  return unknownSensorsForClient;

}