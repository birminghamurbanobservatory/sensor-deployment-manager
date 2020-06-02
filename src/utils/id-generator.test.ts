import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from './id-generator';
import * as check from 'check-types';


//-------------------------------------------------
// Tests
//-------------------------------------------------
describe('generateId function', () => {

  test('Returns a string when no label provided', () => {
    const sensorId = generateId();
    expect(check.nonEmptyString(sensorId)).toBe(true);
  });

  test('Returns a string when a label is provided', () => {
    const sensorId = generateId('some label');
    expect(check.nonEmptyString(sensorId)).toBe(true);
  });

  test('Suffix is added to the end (no label)', () => {
    const sensorId = generateId();
    expect(sensorId.endsWith(suffixForGeneratedIds)).toBe(true);
  });

  test('Suffix is added to the end (with label)', () => {
    const sensorId = generateId('some label');
    expect(sensorId.endsWith(suffixForGeneratedIds)).toBe(true);
  });

  test('Handles long labels', () => {
    const sensorId = generateId('some label that is really long and such!');
    expect(sensorId.length < 48).toBe(true);
  });

  test('Generated ID contains some of the label', () => {
    const label = 'superdupersensor';
    const sensorId = generateId(label);
    expect(sensorId.includes(label)).toBe(true);
  });

});


describe('Testing of hasIdBeenGenerated function', () => {

  test('Check an generated id returns true when passed to the function (no label)', () => {
    const generatedId = generateId();
    const result = hasIdBeenGenerated(generatedId);
    expect(result).toBe(true);
  });

  test('Check an generated id returns true when passed to the function (label given)', () => {
    const generatedId = generateId('Some Label');
    const result = hasIdBeenGenerated(generatedId);
    expect(result).toBe(true);
  });

});