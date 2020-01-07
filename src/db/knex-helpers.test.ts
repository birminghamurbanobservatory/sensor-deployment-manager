import {convertToValuesString} from './knex-helpers';


describe('Test convertToValuesString function', () => {

  test('Converts as expected', () => {

    const input = ['2T9-PYvw9L', '3vH8_oCIh0', '7F4jVZX1HF'];
    const expected = `('2T9-PYvw9L'), ('3vH8_oCIh0'), ('7F4jVZX1HF')`;
    const result = convertToValuesString(input);

    expect(result).toBe(expected);

  });

  test('Should throw an error if array is empty', () => {
    expect(() => {
      convertToValuesString([]);
    }).toThrowError();
  });

});