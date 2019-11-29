import {generateSensorId, prefixForGeneratedIds} from './generate-sensor-id';
import * as check from 'check-types';


//-------------------------------------------------
// Tests
//-------------------------------------------------
describe('generateSensorId function', () => {

  test('Returns a string when no name provided', () => {
    const sensorId = generateSensorId();
    expect(check.nonEmptyString(sensorId)).toBe(true);
  });

  test('Returns a string when a name is provided', () => {
    const sensorId = generateSensorId('some name');
    expect(check.nonEmptyString(sensorId)).toBe(true);
  });

  test('Prefix is added to the start (no name)', () => {
    const sensorId = generateSensorId();
    expect(sensorId.split('-')[0]).toBe(prefixForGeneratedIds);
  });

  test('Prefix is added to the start (with name)', () => {
    const sensorId = generateSensorId('some name');
    expect(sensorId.split('-')[0]).toBe(prefixForGeneratedIds);
  });

  test('Handles long names', () => {
    const sensorId = generateSensorId('some name that is really long and such!');
    expect(sensorId.length < 44).toBe(true);
  });

  test('Generated ID contains some of the name', () => {
    const name = 'superdupersensor';
    const sensorId = generateSensorId(name);
    expect(sensorId.includes(name)).toBe(true);
  });

});