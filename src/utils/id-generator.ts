import {labelToClientId} from './label-to-client-id';
import passwordGenerator from 'password-generator';

const suffixForGeneratedIds = '-susr'; // i.e. standard-user
export {suffixForGeneratedIds};


// If a sensor label is provided we'll incorporate this into the id
export function generateId(label?: string): string {

  let labelSection;
  if (label) {
    const labelSectionFull = labelToClientId(label);
    const n = 28;
    labelSection = labelSectionFull.slice(0, n);  
  }

  const randomPart = passwordGenerator().toLowerCase().slice(0, 8);

  let sensorId;
  if (labelSection) {
    sensorId = `${labelSection}-${randomPart}${suffixForGeneratedIds}`;
  } else {
    sensorId = `${randomPart}${suffixForGeneratedIds}`;
  }

  return sensorId;

}


export function hasIdBeenGenerated(id: string): boolean {
  return id.endsWith(suffixForGeneratedIds);
}