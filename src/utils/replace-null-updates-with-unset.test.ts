import replaceNullUpdatesWithUnset from './replace-null-updates-with-unset';

describe('Testing replaceNullUpdatesWithUnset function', () => {

  test('Correctly modifies updates', () => {
    
    expect(replaceNullUpdatesWithUnset({
      label: 'new label',
      inDeployment: null
    })).toEqual({
      label: 'new label',
      $unset: {inDeployment: ''}
    });

  });

});