import {config} from '../config';
import * as logger from 'node-logger';
import {connectDb, disconnectDb} from '../utils/db';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as sensorController from '../components/sensor/sensor.controller';
import * as contextService from '../components/context/context.service';
import * as check from 'check-types';


describe('Context documents are created and updated correctly', () => {

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


  test('For the various stages of a sensors lifecycle the context should update correctly', async () => {

    expect.assertions(3);

    // Create a sensor
    const sensor = {
      id: 'sensor-123',
      name: 'Sensor 123',
      defaults: {
        observedProperty: {
          value: 'temperature'
        },
        hasFeatureOfInterest: {
          value: 'weather'
        }
      }
    };
    const createdSensor = await sensorController.createSensor(sensor);

    // Let's check that the appropriate context has been created.
    const context1 = await contextService.getLiveContextForSensor(sensor.id);
    const context1Id = context1.id;
    expect(check.nonEmptyString(context1Id)).toBe(true);
    const context1StartDate = context1.startDate;
    expect(check.date(context1StartDate)).toBe(true);
    expect(context1).toEqual({
      id: context1Id,
      sensor: sensor.id,
      startDate: context1StartDate,
      toAdd: sensor.defaults
    });
    // TODO: Why aren't my defaults being added to the context, and why is the full toAdd structure defined in the Context schema being saved to the database?

    
  });




});