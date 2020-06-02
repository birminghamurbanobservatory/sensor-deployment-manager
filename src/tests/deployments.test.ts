import {config} from '../config';
import * as logger from 'node-logger';
import {connectDb, disconnectDb} from '../db/mongodb-service';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as deploymentController from '../components/deployment/deployment.controller';
import Deployment from '../components/deployment/deployment.model';
import * as platformController from '../components/platform/platform.controller';
import * as sensorController from '../components/sensor/sensor.controller';
import * as contextService from '../components/context/context.service';
import Context from '../components/context/context.model';


describe('Testing the functionality of the deployment code, in particular the knock on effect updating/deleting a deployment has on other database collections', () => {

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


  test('Creating a deployment', async () => {

    expect.assertions(7);

    const initialClientDeployment = {
      label: 'Deployment 1',
      description: 'My first deployment',
      createdBy: 'user-1'
    };

    const createdDeployment = await deploymentController.createDeployment(initialClientDeployment);

    expect(createdDeployment.label).toBe(initialClientDeployment.label);
    expect(createdDeployment.description).toBe(initialClientDeployment.description);
    expect(createdDeployment.id).toBe('deployment-1');
    expect(createdDeployment.public).toBe(false);
    expect(createdDeployment.users).toEqual([
      {
        id: initialClientDeployment.createdBy,
        level: 'admin'
      }
    ]);
    expect(createdDeployment).toHaveProperty('createdAt');
    expect(createdDeployment).toHaveProperty('updatedAt');

  });



  test('Changing a deployment to private has the desired knock on effects', async () => {
    
    expect.assertions(13);

    //------------------------
    // Deployment 1
    //------------------------
    const deploymentOneClient = {
      label: 'Deployment 1',
      createdBy: 'user-1',
      public: true
    };
    const deploymentOne = await deploymentController.createDeployment(deploymentOneClient);

    // Create a platform in the first deployment
    const platformInDepOneClient = {
      label: 'park 1',
      inDeployment: deploymentOne.id,
      static: true
    };
    const platformInDepOne = await platformController.createPlatform(platformInDepOneClient);

    // Add a sensor to this platform
    const platformInDepOneSensorClient = {
      hasDeployment: deploymentOne.id
    };
    let platformInDepOneSensor = await sensorController.createSensor(platformInDepOneSensorClient);
    platformInDepOneSensor = await sensorController.updateSensor(platformInDepOneSensor.id, {isHostedBy: platformInDepOne.id});

    //------------------------
    // Second deployment
    //------------------------
    const deploymentTwoClient = {
      label: 'Deployment 2',
      createdBy: 'user-2'
    };
    const deploymentTwo = await deploymentController.createDeployment(deploymentTwoClient);

    // Create a platform in the deploymentTwo that we'll later host on a platform in the first deployment
    const platformInDepTwoClient = {
      label: 'Stevenson Screen',
      inDeployment: deploymentTwo.id,
      static: false
    };
    const platformInDepTwo = await platformController.createPlatform(platformInDepTwoClient);

    // Create a sensor hosted on this platform
    const platformInDepTwoSensorClient = {
      label: 'Mercury Thermometer',
      hasDeployment: deploymentTwo.id
    };
    let platformInDepTwoSensor = await sensorController.createSensor(platformInDepTwoSensorClient);

    platformInDepTwoSensor = await sensorController.updateSensor(platformInDepTwoSensor.id, {isHostedBy: platformInDepTwo.id});

    // Check this sensor's context is as expected
    const platformInDepTwoSensorContext = await contextService.getLiveContextForSensor(platformInDepTwoSensor.id);
    expect(platformInDepTwoSensorContext).toMatchObject({
      hostedByPath: [platformInDepTwo.id],
      hasDeployment: deploymentTwo.id
    });

    // Create a standalone sensor
    const standaloneSensorClient = {
      hasDeployment: deploymentTwo.id
    };
    const standaloneSensor = await sensorController.createSensor(standaloneSensorClient);

    //------------------------
    // Host external platform
    //------------------------
    // Let's host a platform from the deploymentTwo on a platform from the original network
    const updatedplatformInDepTwo = await platformController.rehostPlatform(platformInDepTwo.id, platformInDepOne.id);
    // Let's check the updated platform's host details
    expect(updatedplatformInDepTwo.isHostedBy).toBe(platformInDepOne.id);
    expect(updatedplatformInDepTwo.hostedByPath).toEqual([platformInDepOne.id]);

    // Check context of the external sensor on this platform is correct
    const updatedplatformInDepTwoSensorContext = await contextService.getLiveContextForSensor(platformInDepTwoSensor.id);
    expect(updatedplatformInDepTwoSensorContext).toMatchObject({
      hostedByPath: [platformInDepOne.id, platformInDepTwo.id],
      hasDeployment: deploymentTwo.id
      // Note how the sensor doesn't end up "in" the original deployment, merely its hosted on the deployment's platform. It would only end up "in" when the host platform is shared with the new deployment.
    });

    //------------------------
    // Host standalone sensor
    //------------------------
    // Host the standalone sensor on the platform in the original network
    const hostedStandaloneSensor = await sensorController.updateSensor(standaloneSensor.id, {isHostedBy: platformInDepOne.id});
    expect(hostedStandaloneSensor.isHostedBy).toBe(platformInDepOne.id);
    // Check the context has updated
    const hostedStandaloneSensorContext = await contextService.getLiveContextForSensor(standaloneSensor.id);
    expect(hostedStandaloneSensorContext).toMatchObject({
      hostedByPath: [platformInDepOne.id],
      hasDeployment: deploymentTwo.id
      // Note how the sensor doesn't end up "in" the original deployment, merely its hosted on the deployment's platform.
    });

    //------------------------
    // Make private
    //------------------------
    // Now to make the deployment private
    const updatedDeploymentOne = await deploymentController.updateDeployment(deploymentOne.id, {public: false});
    expect(updatedDeploymentOne.public).toBe(false);

    // The external platform should no longer be hosted on the original deployment's platform
    const unhostedPlatformInDepTwo = await platformController.getPlatform(platformInDepTwo.id);
    expect(unhostedPlatformInDepTwo.isHostedBy).toBeUndefined();
    expect(unhostedPlatformInDepTwo.hostedByPath).toBeUndefined();

    // Its sensor's context should also reflect this
    const unhostedExternalSensorContext = await contextService.getLiveContextForSensor(platformInDepTwoSensor.id);
    expect(unhostedExternalSensorContext).toMatchObject({
      hostedByPath: [platformInDepTwo.id],
      hasDeployment: deploymentTwo.id
    });

    // The standalone sensor should now be unhosted
    const unhostedStandaloneSensor = await sensorController.getSensor(standaloneSensor.id);
    expect(unhostedStandaloneSensor.isHostedBy).toBeUndefined();
    // Check it's context too
    const unhostedStandaloneSensorContext = await contextService.getLiveContextForSensor(standaloneSensor.id);
    expect(unhostedStandaloneSensorContext.hasDeployment).toEqual(deploymentTwo.id);
    expect(unhostedStandaloneSensorContext.hostedByPath).toBeUndefined();

  });



});