import {nameToClientId} from './name-to-client-id';
import passwordGenerator from 'password-generator';
import * as check from 'check-types';

const prefixForGeneratedIds = 'ds'; // i.e. deployment sensor
export {prefixForGeneratedIds};


// If a sensor name is provided we'll incorporate this into the id
export function generateSensorId(name?: string): string {

  let nameSection;
  if (name) {
    const nameSectionFull = nameToClientId(name);
    const n = 24;
    nameSection = nameSectionFull.slice(0, n);  
  }

  const randomPart = passwordGenerator().toLowerCase().slice(0, 8);

  let sensorId;
  if (nameSection) {
    sensorId = `${prefixForGeneratedIds}-${nameSection}-${randomPart}`;
  } else {
    sensorId = `${prefixForGeneratedIds}-${randomPart}`;
  }

  return sensorId;

}