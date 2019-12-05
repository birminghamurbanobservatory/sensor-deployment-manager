import {giveObsContext} from './context.helpers';


describe('mergeObsWithContext function tests', () => {

  test('Merges as expected for a common scenario', () => {
    
    const observation = {
      madeBySensor: 'sensor123',
      hasResult: {
        value: 22.2
      },
      resultTime: '2019-12-04T13:00:19.665Z' 
    };

    const toAdd = { 
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],
      observedProperty: {
        value: 'air-temperature'
      },
      hasFeatureOfInterest: {
        value: 'weather'
      },
      usedProcedures: {
        value: ['point-sample']
      }
    };

    const expected = {
      madeBySensor: 'sensor123',
      hasResult: {
        value: 22.2
      },
      resultTime: '2019-12-04T13:00:19.665Z',
      observedProperty: 'air-temperature',
      hasFeatureOfInterest: 'weather',   
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],     
      usedProcedures: ['point-sample']
    };

    const merged = giveObsContext(observation, toAdd);
    expect(merged).toEqual(expected);

  });


  test('Can handle some ifs', () => {
    
    const observation = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: '2019-12-04T13:00:19.665Z',
      observedProperty: 'solar-radiation' 
    };

    const toAdd = { 
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],
      observedProperty: {
        value: 'voltage' // this is the default, that should be ignored given it's already present
      },
      hasFeatureOfInterest: {
        value: 'energy', // this is the default, that should be overwriten in this scenario
        ifs: [
          {
            if: {
              observedProperty: 'solar-radiation'
            },
            value: 'weather'
          }
        ]
      }
    };

    const expected = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: '2019-12-04T13:00:19.665Z',
      observedProperty: 'solar-radiation',
      hasFeatureOfInterest: 'weather',   
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],         
    };

    const merged = giveObsContext(observation, toAdd);
    expect(merged).toEqual(expected);

  });




  test('Applies values first if no IFs, then IFs, then values with IFs (case 1)', () => {
    
    const observation = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: '2019-12-04T13:00:19.665Z'
    };

    const toAdd = { 
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],
      observedProperty: {
        value: 'voltage'
      },
      hasFeatureOfInterest: {
        ifs: [
          {
            if: {
              observedProperty: 'voltage'
            },
            value: 'energy'
          },
          {
            if: {
              observedProperty: 'solar-radiation'
            },
            value: 'weather'
          }
        ]
      }
    };

    const expected = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: '2019-12-04T13:00:19.665Z',
      observedProperty: 'voltage',
      hasFeatureOfInterest: 'energy',   
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],         
    };

    const merged = giveObsContext(observation, toAdd);
    expect(merged).toEqual(expected);

  });


  test('Applies values first if no IFs, then IFs, then values with IFs (case 2)', () => {
    
    const observation = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: '2019-12-04T13:00:19.665Z',
      observedProperty: 'solar-radiation' // in this case the observed property is provided
    };

    const toAdd = { 
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],
      observedProperty: {
        value: 'voltage'
      },
      hasFeatureOfInterest: {
        ifs: [
          {
            if: {
              observedProperty: 'voltage'
            },
            value: 'energy'
          },
          {
            if: {
              observedProperty: 'solar-radiation'
            },
            value: 'weather'
          }
        ]
      }
    };

    const expected = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: '2019-12-04T13:00:19.665Z',
      observedProperty: 'solar-radiation',
      hasFeatureOfInterest: 'weather',   
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],         
    };

    const merged = giveObsContext(observation, toAdd);
    expect(merged).toEqual(expected);

  });


});