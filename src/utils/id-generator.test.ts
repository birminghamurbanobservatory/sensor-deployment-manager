import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from './id-generator';
import * as check from 'check-types';


//-------------------------------------------------
// Tests
//-------------------------------------------------
describe('generateId function', () => {

  test('Returns a string when no name provided', () => {
    const sensorId = generateId();
    expect(check.nonEmptyString(sensorId)).toBe(true);
  });

  test('Returns a string when a name is provided', () => {
    const sensorId = generateId('some name');
    expect(check.nonEmptyString(sensorId)).toBe(true);
  });

  test('Suffix is added to the end (no name)', () => {
    const sensorId = generateId();
    expect(sensorId.endsWith(suffixForGeneratedIds)).toBe(true);
  });

  test('Suffix is added to the end (with name)', () => {
    const sensorId = generateId('some name');
    expect(sensorId.endsWith(suffixForGeneratedIds)).toBe(true);
  });

  test('Handles long names', () => {
    const sensorId = generateId('some name that is really long and such!');
    expect(sensorId.length < 48).toBe(true);
  });

  test('Generated ID contains some of the name', () => {
    const name = 'superdupersensor';
    const sensorId = generateId(name);
    expect(sensorId.includes(name)).toBe(true);
  });

});


describe('Testing of hasIdBeenGenerated function', () => {

  test('Check an generated id returns true when passed to the function (no name)', () => {
    const generatedId = generateId();
    const result = hasIdBeenGenerated(generatedId);
    expect(result).toBe(true);
  });

  test('Check an generated id returns true when passed to the function (name given)', () => {
    const generatedId = generateId('Some Name');
    const result = hasIdBeenGenerated(generatedId);
    expect(result).toBe(true);
  });

});