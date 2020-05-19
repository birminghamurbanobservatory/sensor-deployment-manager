import {calculateChangeStatus} from './change-status';

describe('Testing of calculateChangeStatus function', () => {

  test('Handles a property changing value', () => {
    
    const oldObj = {
      foo: 'a',
    };

    const updates = {
      foo: 'b',
    };

    const expected = {
      wasSet: true,
      settingNow: true,
      unsettingNow: false,
      willBeSet: true,
      isChanging: true,
      valueWillBe: 'b'
    };

    const changeStatus = calculateChangeStatus('foo', oldObj, updates);
    expect(changeStatus).toEqual(expected);

  });


  test('Handles a property being set for the first time', () => {
    
    const oldObj = {
    };

    const updates = {
      foo: 'b',
    };

    const expected = {
      wasSet: false,
      settingNow: true,
      unsettingNow: false,
      willBeSet: true,
      isChanging: true,
      valueWillBe: 'b'
    };

    const changeStatus = calculateChangeStatus('foo', oldObj, updates);
    expect(changeStatus).toEqual(expected);

  });


  test('Handles a property being unset', () => {
    
    const oldObj = {
      foo: 'a'
    };

    const updates = {
      foo: null,
    };

    const expected = {
      wasSet: true,
      settingNow: false,
      unsettingNow: true,
      willBeSet: false,
      isChanging: true
    };

    const changeStatus = calculateChangeStatus('foo', oldObj, updates);
    expect(changeStatus).toEqual(expected);

  });


  test('Handles a property that is staying the same', () => {
    
    const oldObj = {
      foo: 'a'
    };

    const updates = {
      foo: 'a',
    };

    const expected = {
      wasSet: true,
      settingNow: true,
      unsettingNow: false,
      willBeSet: true,
      isChanging: false,
      valueWillBe: 'a'
    };

    const changeStatus = calculateChangeStatus('foo', oldObj, updates);
    expect(changeStatus).toEqual(expected);

  });


  test('Handles a property that is staying unset', () => {
    
    const oldObj = {
    };

    const updates = {
      foo: null,
    };

    const expected = {
      wasSet: false,
      settingNow: false,
      unsettingNow: true,
      willBeSet: false,
      isChanging: false
    };

    const changeStatus = calculateChangeStatus('foo', oldObj, updates);
    expect(changeStatus).toEqual(expected);

  });


  test('Handles a property that was set but is having nothing done to it', () => {
    
    const oldObj = {
      foo: 'a'
    };

    const updates = {
    };

    const expected = {
      wasSet: true,
      settingNow: false,
      unsettingNow: false,
      willBeSet: true,
      isChanging: false,
      valueWillBe: 'a'
    };

    const changeStatus = calculateChangeStatus('foo', oldObj, updates);
    expect(changeStatus).toEqual(expected);

  });


  test('Handles a property that was not set and is having nothing done to it', () => {
    
    const oldObj = {
    };

    const updates = {
    };

    const expected = {
      wasSet: false,
      settingNow: false,
      unsettingNow: false,
      willBeSet: false,
      isChanging: false
    };

    const changeStatus = calculateChangeStatus('foo', oldObj, updates);
    expect(changeStatus).toEqual(expected);

  });

});