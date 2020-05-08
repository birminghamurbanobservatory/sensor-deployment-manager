import {renameProperty, renameProperties} from './rename';

describe('Testing of renameProperty function', () => {

  test('Renames as expected', () => {
    
    const objectBefore = {
      a: 1,
      b: 2
    };

    const expected = {
      c: 1,
      b: 2
    };

    const objectAfter = renameProperty(objectBefore, 'a', 'c');
    expect(objectAfter).toEqual(expected);
    // Becasue the function mutates rather than creating a new object the following should be true
    expect(objectBefore === objectAfter).toBe(true);

  });


  test('Should not throw an error if the old key is not present', () => {
    
    const objectBefore = {
      a: 1,
      b: 2
    };

    const expected = {
      a: 1,
      b: 2
    };

    const objectAfter = renameProperty(objectBefore, 'd', 'c');
    expect(objectAfter).toEqual(expected);

  });


  test('Does not allow you to overwrite a property that already exists', () => {
    
    const objectBefore = {
      a: 1,
      b: 2
    };

    expect(() => {
      renameProperty(objectBefore, 'a', 'b');
    }).toThrowError();

  });


});



describe('Testing of renameProperties function', () => {

  test('Renames as expected', () => {
    
    const objectBefore = {
      a: 1,
      b: 2,
      c: 3
    };

    const expected = {
      d: 1,
      b: 2,
      e: 3
    };

    const objectAfter = renameProperties(objectBefore, {a: 'd', c: 'e'});
    expect(objectAfter).toEqual(expected);
    // Becasue the function mutates rather than creating a new object the following should be true
    expect(objectBefore === objectAfter).toBe(true);

  });


  test('Lets you overwrite an existing property if you rename it earlier in the same request', () => {
    
    const objectBefore = {
      a: 1,
      b: 2,
      c: 3
    };

    const mappings = {
      c: 'd', // first rename c,
      a: 'c' // now we should be safe to rename something to c
    };

    const expected = {
      c: 1,
      b: 2,
      d: 3
    };

    const objectAfter = renameProperties(objectBefore, mappings);
    expect(objectAfter).toEqual(expected);
    // Becasue the function mutates rather than creating a new object the following should be true
    expect(objectBefore === objectAfter).toBe(true);

  });


});