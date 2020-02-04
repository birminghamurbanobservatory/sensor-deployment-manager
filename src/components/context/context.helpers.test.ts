import {giveObsContext} from './context.helpers';
import {ContextApp} from './context-app.class';


describe('mergeObsWithContext function tests', () => {

  test('Merges as expected for a common scenario', () => {
    
    const observation = {
      madeBySensor: 'sensor123',
      hasResult: {
        value: 22.2
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z') 
    };

    const context: ContextApp = { 
      sensor: 'sensor123',
      startDate: new Date('2019-12-02T15:00:12.775Z'),
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],
      defaults: [
        { 
          observedProperty: 'air-temperature'
        }, {
          hasFeatureOfInterest: 'weather'
        },
        {
          usedProcedures: ['point-sample']
        }
      ]
    };

    const expected = {
      madeBySensor: 'sensor123',
      hasResult: {
        value: 22.2
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'air-temperature',
      hasFeatureOfInterest: 'weather',   
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],     
      usedProcedures: ['point-sample']
    };

    const merged = giveObsContext(observation, context);
    expect(merged).toEqual(expected);

  });


  test(`Can handle some 'when' objects`, () => {
    
    const observation = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'solar-radiation' 
    };

    const context: ContextApp = { 
      sensor: 'solar-panel-123',
      startDate: new Date('2019-12-02T15:00:12.775Z'),      
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],
      defaults: [
        {
          observedProperty: 'voltage'
        },
        {
          hasFeatureOfInterest: 'energy'
        },
        {
          hasFeatureOfInterest: 'weather',
          when: {
            observedProperty: 'solar-radiation'
          }
        }
      ]
    };

    const expected = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'solar-radiation',
      hasFeatureOfInterest: 'weather',   
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],         
    };

    const merged = giveObsContext(observation, context);
    expect(merged).toEqual(expected);

  });




  test('Applies values first if no whens, then whens, then values with whens (case 1)', () => {
    
    const observation = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z')
    };

    const context = { 
      sensor: 'solar-panel-123',
      startDate: new Date('2019-12-02T15:00:12.775Z'),      
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],
      defaults: [
        {
          observedProperty: 'voltage'
        },
        {
          hasFeatureOfInterest: 'energy',
          when: {
            observedProperty: 'voltage'
          }
        },
        {
          hasFeatureOfInterest: 'weather',
          when: {
            observedProperty: 'solar-radiation'
          }
        }
      ]
    };

    const expected = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'voltage',
      hasFeatureOfInterest: 'energy',   
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],         
    };

    const merged = giveObsContext(observation, context);
    expect(merged).toEqual(expected);

  });


  test('Applies values first if no whens, then whens, then values with whens (case 2)', () => {
    
    const observation = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'solar-radiation' // in this case the observed property is provided
    };

    const context = { 
      sensor: 'solar-panel-123',
      startDate: new Date('2019-12-02T15:00:12.775Z'),      
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],
      defaults: [
        {
          observedProperty: 'voltage'
        },
        {
          hasFeatureOfInterest: 'energy',
          when: {
            observedProperty: 'voltage'
          }
        },
        {
          hasFeatureOfInterest: 'weather',
          when: {
            observedProperty: 'solar-radiation'
          }
        }
      ]
    };

    const expected = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'solar-radiation',
      hasFeatureOfInterest: 'weather',   
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],         
    };

    const merged = giveObsContext(observation, context);
    expect(merged).toEqual(expected);

  });


});