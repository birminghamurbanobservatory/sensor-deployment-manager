import {InvalidSensorConfig} from './errors/InvalidSensorConfig';
import {SensorConfigApp} from './sensor-config-app';
import {retrieveAllPropertyIdsFromCollection} from '../../utils/collection-helpers';
import * as Promise from 'bluebird';
import {getDiscipline} from '../discipline/discipline.service';
import {getObservableProperty} from '../observable-property/observable-property.service';
import {getUnit} from '../unit/unit.service';
import {getProcedure} from '../procedure/procedure.service';
import {getFeatureOfInterest} from '../feature-of-interest/feature-of-interest.service';


export async function validateSensorConfigArray(configArray: SensorConfigApp[]): Promise<void> {

  const nTrue = configArray.reduce(configReduceFunction, 0);
  if (nTrue > 1) {
    throw new InvalidSensorConfig(`More than one object in the sensor config array has 'hasPriority: true'.`);
  }

  const disciplineIds =  retrieveAllPropertyIdsFromCollection(configArray, 'disciplines');
  const observablePropertyIds = retrieveAllPropertyIdsFromCollection(configArray, 'observedProperty');
  const unitIds = retrieveAllPropertyIdsFromCollection(configArray, 'unit');
  const procedureIds = retrieveAllPropertyIdsFromCollection(configArray, 'procedures');
  const featureOfInterestIds = retrieveAllPropertyIdsFromCollection(configArray, 'hasFeatureOfInterest');

  await Promise.map(disciplineIds, async (id) => {
    // If it doesn't exist it should throw an error
    await getDiscipline(id);
  });

  await Promise.map(observablePropertyIds, async (id) => {
    await getObservableProperty(id);
  });

  await Promise.map(unitIds, async (id) => {
    await getUnit(id);
  });

  await Promise.map(procedureIds, async (id) => {
    await getProcedure(id);
  });

  await Promise.map(featureOfInterestIds, async (id) => {
    await getFeatureOfInterest(id);
  });

  return;

}


function configReduceFunction(count: number, config): number {
  if (config.hasPriority === true) {
    return count + 1;
  } else {
    return count;
  }
}



