import {config} from '../config';
import * as logger from 'node-logger';
import {connectDb, disconnectDb} from '../utils/db';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as sensorController from '../components/sensor/sensor.controller';
import * as permanentHostController from '../components/permanent-host/permanent-host.controller';
import * as contextService from '../components/context/context.service';
import * as deploymentController from '../components/deployment/deployment.controller';
import * as platformController from '../components/platform/platform.controller';
import Context from '../components/context/context.model';
import * as check from 'check-types';
import {register} from '../components/registration/registration.controller';


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

    expect.assertions(7);

    // Create a permanent host
    const permanentHost = {
      name: 'Climavue 123',
      description: 'Climavue weather station'
    };
    const createdPermanentHost = await permanentHostController.createPermanentHost(permanentHost);

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
    
    // Add the sensor to the permanentHost.
    await sensorController.updateSensor(createdSensor.id, {
      permanentHost: createdPermanentHost.id
    });

    // Create a deployment
    const deployment = {
      id: 'my-deployment',
      name: 'My Deployment',
      users: [{id: 'bob', level: 'admin'}]
    };
    const createdDeployment = await deploymentController.createDeployment(deployment);

    // Now to add the permanentHost (with its sensor) to a deployment.
    await register(createdPermanentHost.registrationKey, createdDeployment.id);

    const updatedSensor = await sensorController.getSensor(sensor.id);
    expect(updatedSensor.isHostedBy.startsWith(createdPermanentHost.id)).toBe(true);

    // Check the context
    const context2 = await contextService.getLiveContextForSensor(sensor.id);
    const context2Id = context2.id;
    expect(check.nonEmptyString(context2Id)).toBe(true);
    const context2StartDate = context2.startDate;
    expect(check.date(context2StartDate)).toBe(true);
    expect(context2).toEqual({
      id: context2Id,
      sensor: sensor.id,
      startDate: context2StartDate,
      toAdd: Object.assign(
        {},
        {
          inDeployments: {value: [deployment.id]},
          hostedByPath: {value: [updatedSensor.isHostedBy]}
        }, 
        sensor.defaults
      )
    });

    // Create another platform in the deployment
    const topPlatform = await platformController.createPlatform({
      name: 'building-1',
      ownerDeployment: createdDeployment.id,
      inDeployments: [createdDeployment.id],
      static: true
    });

    // Now lets host the sensor's platform on this new platform.
    


    
  });




});