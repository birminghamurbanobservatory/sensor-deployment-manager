import {giveObsContext} from './context.helpers';
import {ContextApp} from './context-app.class';


describe('giveObsContext function tests', () => {

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
      hasDeployment: 'deployment-1',
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
        value: 22.2,
        unit: 'DegreeCelsius'
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'AirTemperature',
      hasFeatureOfInterest: 'EarthAtmosphere',   
      hasDeployment: 'deployment-1',
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
      hasDeployment: 'deployment-1',
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
        value: 820,
        unit: 'WattPerSquareMetre',
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'SolarRadiation',
      disciplines: ['Meteorology'],    
      hasDeployment: 'deployment-1',
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
      hasDeployment: 'deployment-1',
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
        value: 3.4,
        unit: 'Volt'
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'Voltage',
      disciplines: ['Energy'],    
      hasDeployment: 'deployment-1',
      hostedByPath: ['platform-parent', 'platform-child'],         
    };

    const merged = giveObsContext(observation, context);
    expect(merged).toEqual(expected);

  });



  test('An observation with the observed property set will not inherit the default config if it is for a different observed property (even if no config for the given observed property is available)', () => {
    
    const observation = {
      madeBySensor: 'sensor123',
      hasResult: {
        value: 0.4
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'PrecipitationDepth' 
    };

    const context: ContextApp = { 
      sensor: 'sensor123',
      startDate: new Date('2019-12-02T15:00:12.775Z'),
      config: [
        { 
          hasPriority: true,
          observedProperty: 'PrecipitationRate',
          unit: 'MillimetrePerHour',
          disciplines: ['Hydrology'],
        }
      ]
    };

    const expected = {
      madeBySensor: 'sensor123',
      hasResult: {
        value: 0.4
      },
      resultTime: new Date('2019-12-04T13:00:19.665Z'),
      observedProperty: 'PrecipitationDepth',
      // Crucially the unit and disciplines for the PrecipitationRate shouldn't be added here.
    };

    const merged = giveObsContext(observation, context);
    expect(merged).toEqual(expected);

  });


});