import * as check from 'check-types';


/**
 * Renames properties in an object. Mutates the object rather than creating a new one.
 * @param obj - e.g. {name: 'bob'}
 * @param renameMappings  - e.g. {name: 'firstname'}
 */
export function renameProperties(obj: any, renameMappings: any): any {

  check.assert.object(obj);
  check.assert.object(renameMappings);

  Object.keys(renameMappings).forEach((oldKey): void => {
    const newKey = renameMappings[oldKey];
    check.assert.nonEmptyString(newKey);
    renameProperty(obj, oldKey, newKey);
  });

  return obj;

}


/**
 * Renames a property in an object. Mutates the object rather than creating a new one.
 * @param obj - The object whose properties you want to rename. 
 * @param oldKey - The key you want to rename
 * @param newKey - The new name for the key
 */
export function renameProperty(obj: object, oldKey: string, newKey: string): object {
  check.assert.object(obj);

  // Prevent existing keys from being overwritten
  if (obj.hasOwnProperty(newKey)) {
    throw new Error(`Can not rename the object property '${oldKey}' to '${newKey}' because '${newKey}' already exists in the object.`);
  }

  if (obj.hasOwnProperty(oldKey)) {
    Object.defineProperty(obj, newKey, Object.getOwnPropertyDescriptor(obj, oldKey));
    delete obj[oldKey];
  }

  return obj;
}