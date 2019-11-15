import {config} from '../config';
import * as logger from 'node-logger';
import {connectDb, disconnectDb} from '../utils/db';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as sensorController from '../components/sensor/sensor.controller';
import * as permanentHostController from '../components/permanent-host/permanent-host.controller';
import * as contextService from '../components/context/context.service';
import * as deploymentController from '../components/deployment/deployment.controller';
import * as platformController from '../components/platform/platform.controller';
import * as check from 'check-types';
import {register} from '../components/registration/registration.controller';
import Context from '../components/context/context.model';


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

    expect.assertions(24);

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
          inDeployments: [deployment.id],
          hostedByPath: [updatedSensor.isHostedBy]
        }, 
        sensor.defaults
      )
    });

    // Create another platform in the deployment
    const parentPlatform = await platformController.createPlatform({
      name: 'building-1',
      ownerDeployment: createdDeployment.id,
      inDeployments: [createdDeployment.id],
      static: true
    });

    // Now lets host the sensor's platform on this new platform.
    const platformUpdate1 = await platformController.rehostPlatform(updatedSensor.isHostedBy, parentPlatform.id);
    expect(platformUpdate1.hostedByPath).toEqual([parentPlatform.id]);

    // Check the context
    const context3 = await contextService.getLiveContextForSensor(sensor.id);
    const context3Id = context3.id;
    expect(check.nonEmptyString(context3Id)).toBe(true);
    const context3StartDate = context3.startDate;
    expect(check.date(context3StartDate)).toBe(true);
    expect(context3).toEqual({
      id: context3Id,
      sensor: sensor.id,
      startDate: context3StartDate,
      toAdd: Object.assign(
        {},
        {
          inDeployments: [deployment.id],
          hostedByPath: [parentPlatform.id, platformUpdate1.id]
        }, 
        sensor.defaults
      )
    });    

    // Let's create another parent platform and move it over to that instead
    const secondParentPlatform = await platformController.createPlatform({
      name: 'building-2',
      ownerDeployment: createdDeployment.id,
      inDeployments: [createdDeployment.id],
      static: true
    });
    const platformUpdate2 = await platformController.rehostPlatform(updatedSensor.isHostedBy, secondParentPlatform.id);
    expect(platformUpdate2.hostedByPath).toEqual([secondParentPlatform.id]);

    // Check the context
    const context4 = await contextService.getLiveContextForSensor(sensor.id);
    const context4Id = context4.id;
    expect(check.nonEmptyString(context4Id)).toBe(true);
    const context4StartDate = context4.startDate;
    expect(check.date(context4StartDate)).toBe(true);
    expect(context4).toEqual({
      id: context4Id,
      sensor: sensor.id,
      startDate: context4StartDate,
      toAdd: Object.assign(
        {},
        {
          inDeployments: [deployment.id],
          hostedByPath: [secondParentPlatform.id, platformUpdate2.id]
        }, 
        sensor.defaults
      )
    });   

    // Now lets unhost the platform from it's parent
    const platformUpdate3 = await platformController.unhostPlatform(platformUpdate2.id);
    expect(platformUpdate3.isHostedBy).toBeUndefined();
    expect(platformUpdate3.hostedByPath).toBeUndefined();

    // Check the context
    const context5 = await contextService.getLiveContextForSensor(sensor.id);
    const context5Id = context5.id;
    expect(check.nonEmptyString(context5Id)).toBe(true);
    const context5StartDate = context5.startDate;
    expect(check.date(context5StartDate)).toBe(true);
    expect(context5).toEqual({
      id: context5Id,
      sensor: sensor.id,
      startDate: context5StartDate,
      toAdd: Object.assign(
        {},
        {
          inDeployments: [deployment.id],
          hostedByPath: [platformUpdate3.id]
        }, 
        sensor.defaults
      )
    });      

    // Now to delete the platform from the deployment
    await platformController.deletePlatform(platformUpdate3.id);

    // Let's double check the previous context had been ended
    const context5Ended = await contextService.getContext(context5.id);
    expect(check.date(context5Ended.endDate)).toBe(true);

    // Check the context
    const context6 = await contextService.getLiveContextForSensor(sensor.id);
    const context6Id = context6.id;
    expect(check.nonEmptyString(context6Id)).toBe(true);
    const context6StartDate = context6.startDate;
    expect(check.date(context6StartDate)).toBe(true);
    expect(context6).toEqual({
      id: context6Id,
      sensor: sensor.id,
      startDate: context6StartDate,
      toAdd: sensor.defaults // back to just the defaults
    });


  });




});