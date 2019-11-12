import {cloneDeep} from 'lodash';

export default function replaceNullUpdatesWithUnset(updates: any): any {
  
  const modifiedUpdates = cloneDeep(updates);
  Object.keys(modifiedUpdates).forEach((key) => {
    if (modifiedUpdates[key] === null) {
      if (!modifiedUpdates.$unset) {
        modifiedUpdates.$unset = {};
      }
      modifiedUpdates.$unset[key] = '';
      delete modifiedUpdates[key];
    }
  });

  return modifiedUpdates;

}