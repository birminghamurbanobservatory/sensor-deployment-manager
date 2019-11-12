import replaceNullUpdatesWithUnset from './replace-null-updates-with-unset';

describe('Testing replaceNullUpdatesWithUnset function', () => {

  test('Correctly modifies updates', () => {
    
    expect(replaceNullUpdatesWithUnset({
      name: 'new name',
      inDeployment: null
    })).toEqual({
      name: 'new name',
      $unset: {inDeployment: ''}
    });

  });

});