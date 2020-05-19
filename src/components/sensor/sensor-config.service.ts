import {InvalidSensorConfig} from './errors/InvalidSensorConfig';
import {SensorConfigApp} from './sensor-config-app';


export async function validateSensorConfigArray(configArray: SensorConfigApp[]): Promise<void> {

  const nTrue = configArray.reduce(configReduceFunction, 0);
  if (nTrue > 1) {
    throw new InvalidSensorConfig(`More than one object in the sensor config array has 'hasPriority: true'.`);
  }

  // TODO: I need to run through each of the IDs defined in the config and check they actually exist in the database, e.g. the disciplines, units, etc, etc.

  return;

}


function configReduceFunction(count: number, config): number {
  if (config.hasPriority === true) {
    return count + 1;
  } else {
    return count;
  }
}
