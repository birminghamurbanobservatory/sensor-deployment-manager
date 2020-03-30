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
      config: [
        { 
          hasPriority: true,
          observedProperty: 'AirTemperature',
          unit: 'DegreeCelsius',
          hasFeatureOfInterest: 'EarthAtmosphere',
          disciplines: ['Meteorology'],
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
      observedProperty: 'AirTemperature',
      unit: 'DegreeCelsius',
      hasFeatureOfInterest: 'EarthAtmosphere',   
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],     
      usedProcedures: ['point-sample'],
      disciplines: ['Meteorology'],
    };

    const merged = giveObsContext(observation, context);
    expect(merged).toEqual(expected);

  });


  test(`Works when as expected when multiple configs defined`, () => {
    
    const observation = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'SolarRadiation' 
    };

    const context: ContextApp = { 
      sensor: 'solar-panel-123',
      startDate: new Date('2019-12-02T15:00:12.775Z'),      
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],
      config: [
        {
          hasPriority: true,
          observedProperty: 'Voltage',
          unit: 'Volt',
          disciplines: ['Energy']
        },
        {
          hasPriority: false,
          observedProperty: 'SolarRadiation',
          unit: 'WattPerSquareMetre',
          disciplines: ['Meteorology']        
        },
      ]
    };

    const expected = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 820
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'SolarRadiation',
      unit: 'WattPerSquareMetre',
      disciplines: ['Meteorology'],    
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],         
    };

    const merged = giveObsContext(observation, context);
    expect(merged).toEqual(expected);

  });



  test(`Applies the hasPriority config when no observed property in the observation`, () => {
    
    const observation = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 3.4
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
    };

    const context: ContextApp = { 
      sensor: 'solar-panel-123',
      startDate: new Date('2019-12-02T15:00:12.775Z'),      
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],
      config: [
        {
          hasPriority: true,
          observedProperty: 'Voltage',
          unit: 'Volt',
          disciplines: ['Energy']
        },
        {
          hasPriority: false,
          observedProperty: 'SolarRadiation',
          unit: 'WattPerSquareMetre',
          disciplines: ['Meteorology']        
        },
      ]
    };

    const expected = {
      madeBySensor: 'solar-panel-123',
      hasResult: {
        value: 3.4
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'Voltage',
      unit: 'Volt',
      disciplines: ['Energy'],    
      inDeployments: ['deployment-1'],
      hostedByPath: ['platform-parent', 'platform-child'],         
    };

    const merged = giveObsContext(observation, context);
    expect(merged).toEqual(expected);

  });


});