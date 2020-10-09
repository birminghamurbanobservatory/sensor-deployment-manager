import {trim} from 'lodash';


export function labelToClientId(label: string): string {

  const trimmed = trim(label);
  const lowercased = trimmed.toLowerCase();
  const noSpaces = lowercased.replace(/\s+/g, '-');
  const urlSafe = noSpaces.replace(/[^a-z0-9-]/g, '');

  const clientId = urlSafe;
  return clientId;

}