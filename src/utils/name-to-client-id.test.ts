import {nameToClientId} from './name-to-client-id';


//-------------------------------------------------
// Tests
//-------------------------------------------------
describe('name to clientId function', () => {

  test('Convert standard space separated name', () => {
    const name = 'reference weather stations';
    const expected = 'reference-weather-stations';
    expect(nameToClientId(name)).toBe(expected);
  });

  
  test('Removes any characters unsafe for a url', () => {
    const name = 'reference %*stat/ions';
    const expected = 'reference-stations';
    expect(nameToClientId(name)).toBe(expected);
  });
  
  
  test('Removes any upper case characters', () => {
    const name = 'Reference Weather Stations';
    const expected = 'reference-weather-stations';
    expect(nameToClientId(name)).toBe(expected);
  });  


});