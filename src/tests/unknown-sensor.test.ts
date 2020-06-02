import {config} from '../config';
import * as logger from 'node-logger';
import {connectDb, disconnectDb} from '../db/mongodb-service';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as sensorController from '../components/sensor/sensor.controller';
import * as permanentHostController from '../components/permanent-host/permanent-host.controller';
import * as unknownSensorController from '../components/unknown-sensor/unknown-sensor.controller';
import * as contextService from '../components/context/context.service';
import * as contextController from '../components/context/context.controller';
import {createObservableProperty} from '../components/observable-property/observable-property.controller';

describe('Unknown sensor tests', () => {

  let mongoServer;

  beforeAll(() => {
    // Configure the logger
    logger.configure(config.logger);
  });

  beforeEach(() => {
    // Create fresh database
    mongoServer = new MongodbMemoryServer.MongoMemoryServer();
    return mongoServer.getConnectionString()
    .then((url) => {
      return connectDb(url);
    });    
  });

  afterEach(() => {
    // Disconnect from, then stop, database.
    return disconnectDb()
    .then(() => {
      mongoServer.stop();
      return;
    });
  });  


  test('Unknown sensor workflow should work as expected', async () => {

    expect.assertions(14);

    // For even greater peace of mind, let's create a sensor that is known first.
    // Create a permanent host
    const permanentHostClient = {
      label: 'Climavue 123',
    };
    const permanentHost = await permanentHostController.createPermanentHost(permanentHostClient);

    const exampleObservedProperty = 'air-temperature';
    await createObservableProperty({id: exampleObservedProperty});

    // Create a sensor
    const knownSensorClient = {
      id: 'sensor-123',
      label: 'Sensor 123',
      permanentHost: permanentHost.id,
      initialConfig: [
        {
          hasPriority: true,
          observedProperty: exampleObservedProperty
        }
      ]
    };
    const knownSensor = await sensorController.createSensor(knownSensorClient);

    // Let's check that the appropriate context has been created.
    const knownSensorContext = await contextService.getLiveContextForSensor(knownSensor.id);
    expect(knownSensorContext.sensor).toBe(knownSensor.id);

    // Now let's add context to an observation from this known sensor
    const knownSensorObsWithoutContext = {
      madeBySensor: knownSensor.id,
      hasResult: {
        value: 22.6
      },
      resultTime: new Date().toISOString()
    };
    const knownSensorObsWithContext = await contextController.addContextToObservation(knownSensorObsWithoutContext);
    expect(knownSensorObsWithContext.observedProperty).toBe(exampleObservedProperty);

    // At this point there should be no unknown sensors
    const result1 = await unknownSensorController.getUnknownSensors();
    let unknownSensors = result1.data;
    expect(unknownSensors.length).toBe(0);

    // Now to try adding context to an unknown sensor obs
    const unknownSensorId = 'some-unknown-sensor';
    const unknownSensorObsWithoutContext1 = {
      madeBySensor: unknownSensorId,
      hasResult: {
        value: 20.1
      },
      resultTime: new Date().toISOString()
    };
    const unknownSensorObsWithContext = await contextController.addContextToObservation(unknownSensorObsWithoutContext1);
    // Nothing should have changed to the obs
    expect(unknownSensorObsWithContext).toEqual(unknownSensorObsWithoutContext1);

    // We should now have any unknown sensor
    const result2 = await unknownSensorController.getUnknownSensors();
    unknownSensors = result2.data;
    expect(unknownSensors.length).toBe(1);
    let unknownSensor = unknownSensors[0];
    expect(typeof unknownSensor.createdAt).toBe('string');
    expect(typeof unknownSensor.updatedAt).toBe('string');
    expect(unknownSensor).toEqual({
      id: unknownSensorId,
      nObservations: 1,
      lastObservation: unknownSensorObsWithoutContext1,
      createdAt: unknownSensor.createdAt,
      updatedAt: unknownSensor.updatedAt
    });

    // Let's pass it another observation to make sure nObservations increments
    const unknownSensorObsWithoutContext2 = {
      madeBySensor: unknownSensorId,
      hasResult: {
        value: 18.4
      },
      resultTime: new Date().toISOString()
    };
    const unknownSensorObsWithContext2 = await contextController.addContextToObservation(unknownSensorObsWithoutContext2);
    // Nothing should have changed to the obs
    expect(unknownSensorObsWithContext2).toEqual(unknownSensorObsWithoutContext2);
    // Get the unknown sensors
    const result3 = await unknownSensorController.getUnknownSensors();
    unknownSensors = result3.data;
    expect(unknownSensors.length).toBe(1);
    unknownSensor = unknownSensors[0];
    expect(unknownSensor).toEqual({
      id: unknownSensorId,
      nObservations: 2,
      lastObservation: unknownSensorObsWithoutContext2,
      createdAt: unknownSensor.createdAt,
      updatedAt: unknownSensor.updatedAt
    });

    // Now let's create the sensor for real
    const nowKnownSensorClient = {
      id: unknownSensorId,
      label: 'Now known sensor',
      permanentHost: permanentHost.id,
      initialConfig: [
        {
          hasPriority: true,
          observedProperty: exampleObservedProperty
        }
      ]
    };

    const nowKnownSensor = await sensorController.createSensor(nowKnownSensorClient);

    // There should now be no unknown sensors
    const result4 = await unknownSensorController.getUnknownSensors();
    unknownSensors = result4.data;
    expect(unknownSensors.length).toBe(0);

    // Now when we ask for context it should get some
    const nowKnownSensorObsWithoutContext = {
      madeBySensor: unknownSensorId,
      hasResult: {
        value: 16.6
      },
      resultTime: new Date().toISOString()
    };
    const nowKnownSensorObsWithContext = await contextController.addContextToObservation(nowKnownSensorObsWithoutContext);
    expect(nowKnownSensorObsWithContext.observedProperty).toBe(exampleObservedProperty);

    // There should still be no unknown sensors
    const result5 = await unknownSensorController.getUnknownSensors();
    unknownSensors = result5.data;
    expect(unknownSensors.length).toBe(0);

  });


});