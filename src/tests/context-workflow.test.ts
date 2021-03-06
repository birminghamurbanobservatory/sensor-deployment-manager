import {config} from '../config';
import * as logger from 'node-logger';
import {connectDb, disconnectDb} from '../db/mongodb-service';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as sensorController from '../components/sensor/sensor.controller';
import * as permanentHostController from '../components/permanent-host/permanent-host.controller';
import * as contextService from '../components/context/context.service';
import * as deploymentController from '../components/deployment/deployment.controller';
import * as platformController from '../components/platform/platform.controller';
import * as check from 'check-types';
import {register} from '../components/registration/registration.controller';
import Context from '../components/context/context.model';
import {addContextToObservation} from '../components/context/context.controller';
import {cloneDeep} from 'lodash';
import * as disciplineController from '../components/discipline/discipline.controller';
import * as observablePropertyController from '../components/observable-property/observable-property.controller';


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

    expect.assertions(30);

    // Create a permanent host
    const permanentHost = {
      label: 'Climavue 123',
      description: 'Climavue weather station',
      passLocationToObservations: true
    };
    const createdPermanentHost = await permanentHostController.createPermanentHost(permanentHost);

    // Need to create the following before the sensor can be created
    await observablePropertyController.createObservableProperty({id: 'AirTemperature'});
    await disciplineController.createDiscipline({id: 'Meteorology'});

    // Create a sensor
    const sensorClient = {
      id: 'sensor-123',
      label: 'Sensor 123',
      permanentHost: createdPermanentHost.id,
      initialConfig: [
        {
          hasPriority: true,
          observedProperty: 'AirTemperature',
          disciplines: ['Meteorology']
        }
      ]
    };
    const sensor = await sensorController.createSensor(sensorClient);

    // Let's check that the appropriate context has been created.
    const context1 = await contextService.getLiveContextForSensor(sensor.id);
    const context1Id = context1.id;
    expect(check.nonEmptyString(context1Id)).toBe(true);
    const context1StartDate = context1.startDate;
    expect(check.date(context1StartDate)).toBe(true);
    expect(context1.config).toMatchObject(sensorClient.initialConfig);
    expect(context1).toEqual({
      id: context1Id,
      sensor: sensor.id,
      startDate: context1StartDate,
      config: context1.config,
    });
    
    // Create a deployment
    const deployment = {
      id: 'my-deployment',
      label: 'My Deployment'
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
    expect(context2.config).toMatchObject(sensorClient.initialConfig);  
    expect(context2).toEqual({
      id: context2Id,
      sensor: sensor.id,
      startDate: context2StartDate,
      hasDeployment: deployment.id,
      hostedByPath: [updatedSensor.isHostedBy],
      config: context2.config
    });

    // Create another platform in the deployment
    const parentPlatform = await platformController.createPlatform({
      label: 'building-1',
      inDeployment: createdDeployment.id,
      static: true,
      location: {
        geometry: {
          type: 'Point',
          coordinates: [-1.9, 52.5]
        }
      }
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
    expect(context3.config).toMatchObject(sensorClient.initialConfig);
    expect(context3).toEqual({
      id: context3Id,
      sensor: sensor.id,
      startDate: context3StartDate,
      hasDeployment: deployment.id,
      hostedByPath: [parentPlatform.id, platformUpdate1.id],
      config: context3.config
    });    

    // Let's create another parent platform and move it over to that instead
    const secondParentPlatform = await platformController.createPlatform({
      label: 'building-2',
      inDeployment: createdDeployment.id,
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
    expect(context4.config).toMatchObject(sensorClient.initialConfig);
    expect(context4).toEqual({
      id: context4Id,
      sensor: sensor.id,
      startDate: context4StartDate,
      hasDeployment: deployment.id,
      hostedByPath: [secondParentPlatform.id, platformUpdate2.id],
      config: context4.config
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
    expect(context5.config).toMatchObject(sensorClient.initialConfig);
    expect(context5).toEqual({
      id: context5Id,
      sensor: sensor.id,
      startDate: context5StartDate,
      hasDeployment: deployment.id,
      hostedByPath: [platformUpdate3.id],
      config: context5.config
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
    expect(context6.config).toMatchObject(sensorClient.initialConfig);
    expect(context6).toEqual({
      id: context6Id,
      sensor: sensor.id,
      startDate: context6StartDate,
      // All that's left now is the config
      config: context6.config
    });


  });




  test('Create a sensor that is linked to a deployment from the start', async () => {

    expect.assertions(13);

    // Create a Deployment
    const deploymentClient = {
      label: 'Bobs thermometer Deployment'
    };

    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Create a sensor
    const exampleObservedProperty = 'temperature';
    const exampleDiscipline = 'meteorology';
    await observablePropertyController.createObservableProperty({id: exampleObservedProperty});
    await disciplineController.createDiscipline({id: exampleDiscipline});

    const sensorClient = {
      label: 'Bobs Mercury Thermometer',
      hasDeployment: deployment.id,
      initialConfig: [
        {
          hasPriority: true,
          observedProperty: exampleObservedProperty,
          disciplines: [exampleDiscipline]
        }
      ]
    };

    const sensor = await sensorController.createSensor(sensorClient);    

    // Let's check the appropriate context has been created
    const context1 = await contextService.getLiveContextForSensor(sensor.id);
    const context1Id = context1.id;
    expect(check.nonEmptyString(context1Id)).toBe(true);
    const context1StartDate = context1.startDate;
    expect(check.date(context1StartDate)).toBe(true);
    const context1ConfigWithoutIds = cloneDeep(context1.config).map((def) => {
      delete def.id;
      return def;
    });
    expect(context1ConfigWithoutIds).toEqual(sensorClient.initialConfig);
    expect(context1).toEqual({
      id: context1Id,
      sensor: sensor.id,
      startDate: context1StartDate,
      hasDeployment: deployment.id,
      config: context1.config
    });

    // Let's create a platform in this deployment
    const platformClient = {
      label: 'Bobs back garden',
      static: true,
      inDeployment: deployment.id,
      passLocationToObservations: true,
      location: {
        geometry: {
          type: 'Point',
          coordinates: [-1.929, 52]
        }
      },
    };

    const platform = await platformController.createPlatform(platformClient);
    expect(platform).toHaveProperty('location');
    expect(platform.location.geometry).toEqual(platformClient.location.geometry);
    expect(typeof platform.location.id).toBe('string');
    expect(typeof platform.location.validAt).toBe('string'); // isostring

    // Let's add the sensor to this platform
    await sensorController.updateSensor(sensor.id, {isHostedBy: platform.id});

    // Check the context
    const context2 = await contextService.getLiveContextForSensor(sensor.id);
    const context2Id = context2.id;
    expect(check.nonEmptyString(context2Id)).toBe(true);
    const context2StartDate = context2.startDate;
    expect(check.date(context2StartDate)).toBe(true);
    const context2ConfigWithoutIds = cloneDeep(context2.config).map((def) => {
      delete def.id;
      return def;
    });
    expect(context2ConfigWithoutIds).toEqual(sensorClient.initialConfig);
    expect(context2).toEqual({
      id: context2Id,
      sensor: sensor.id,
      startDate: context2StartDate,
      hasDeployment: deployment.id,
      hostedByPath: [platform.id],
      config: context2.config
    });

    // Now lets submit an observation to check that it gets the correction location applied
    const observationWithoutContext = {
      madeBySensor: sensor.id,
      hasResult: {
        value: 22.6
      },
      resultTime: new Date().toISOString()
    };

    const observationWithContext = await addContextToObservation(observationWithoutContext);
    const platformLocation = cloneDeep(platform.location);
    const expectedObservation = Object.assign({}, observationWithoutContext, {
      hasDeployment: deployment.id,
      hostedByPath: [platform.id],
      observedProperty: exampleObservedProperty,
      disciplines: [exampleDiscipline],
      location: platformLocation
    });
    expect(observationWithContext).toEqual(expectedObservation);

  });



  test('Basic sensor updates, e.g. to its description, do not create a completely new context', async () => {
    
    expect.assertions(7);

    // Create a sensor
    const sensorClient = {
      id: 'sensor-abc'
    };
    const sensor = await sensorController.createSensor(sensorClient);

    let allContexts = await Context.find({}).exec();
    expect(allContexts.length).toBe(1);

    // Change its description
    const sensorNoDeploymentUpdated = await sensorController.updateSensor(sensor.id, {description: 'new info'});
    expect(sensorNoDeploymentUpdated.description).toBe('new info');

    allContexts = await Context.find({}).exec();
    expect(allContexts.length).toBe(1); // should still be 1

    // Add it to a deployment
    const deploymentClient = {
      id: 'deployment-1',
      label: 'Deployment 1'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    const sensorInDeployment = await sensorController.updateSensor(sensor.id, {hasDeployment: deployment.id});
    expect(sensorInDeployment.hasDeployment).toBe(deployment.id);

    allContexts = await Context.find({}).exec();
    expect(allContexts.length).toBe(2); // will be 2 now given the deployment change

    // Now update the description
    const sensorInDeploymentUpdated = await sensorController.updateSensor(sensor.id, {description: 'newer info'});
    expect(sensorInDeploymentUpdated.description).toBe('newer info');

    allContexts = await Context.find({}).exec();
    expect(allContexts.length).toBe(2); // should still be 2

  });

});


