import {nameToClientId} from './name-to-client-id';
import passwordGenerator from 'password-generator';

const suffixForGeneratedIds = '-susr'; // i.e. standard-user
export {suffixForGeneratedIds};


// If a sensor name is provided we'll incorporate this into the id
export function generateId(name?: string): string {

  let nameSection;
  if (name) {
    const nameSectionFull = nameToClientId(name);
    const n = 28;
    nameSection = nameSectionFull.slice(0, n);  
  }

  const randomPart = passwordGenerator().toLowerCase().slice(0, 8);

  let sensorId;
  if (nameSection) {
    sensorId = `${nameSection}-${randomPart}${suffixForGeneratedIds}`;
  } else {
    sensorId = `${randomPart}${suffixForGeneratedIds}`;
  }

  return sensorId;

}


export function hasIdBeenGenerated(id: string): boolean {
  return id.endsWith(suffixForGeneratedIds);
}