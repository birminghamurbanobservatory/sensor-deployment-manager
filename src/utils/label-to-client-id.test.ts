import {labelToClientId} from './label-to-client-id';


//-------------------------------------------------
// Tests
//-------------------------------------------------
describe('name to clientId function', () => {

  test('Convert standard space separated name', () => {
    const label = 'reference weather stations';
    const expected = 'reference-weather-stations';
    expect(labelToClientId(label)).toBe(expected);
  });

  
  test('Removes any characters unsafe for a url', () => {
    const label = 'reference %*stat/ions';
    const expected = 'reference-stations';
    expect(labelToClientId(label)).toBe(expected);
  });
  
  
  test('Removes any upper case characters', () => {
    const label = 'Reference Weather Stations';
    const expected = 'reference-weather-stations';
    expect(labelToClientId(label)).toBe(expected);
  });  


});