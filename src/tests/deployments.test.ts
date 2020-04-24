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


describe('Testing the functionality of the deployment code, in particular the knock on effect updating/deleteing a deployment has on other database collections', () => {


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
      name: 'Deployment 1',
      description: 'My first deployment',
      createdBy: 'user-1'
    };

    const createdDeployment = await deploymentController.createDeployment(initialClientDeployment);

    expect(createdDeployment.name).toBe(initialClientDeployment.name);
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
    
    expect.assertions(16);

    //------------------------
    // Original deployment
    //------------------------

    const originalDeploymentClient = {
      name: 'Deployment 1',
      createdBy: 'user-1',
      public: true
    };
    const originalDeployment = await deploymentController.createDeployment(originalDeploymentClient);

    // Create a platform in the original deployment that won't be shared.
    const nonSharedPlatformClient = {
      name: 'park 1',
      ownerDeployment: originalDeployment.id,
      static: true
    };
    const nonSharedPlatform = await platformController.createPlatform(nonSharedPlatformClient);

    // Add a sensor to this platform
    const nonsharedPlatformSensorClient = {
      hasDeployment: originalDeployment.id
    };
    let nonsharedPlatformSensor = await sensorController.createSensor(nonsharedPlatformSensorClient);
    nonsharedPlatformSensor = await sensorController.hostSensorOnPlatform(nonsharedPlatformSensor.id, nonSharedPlatform.id);

    // Create a platform in the original deployment that will be shared.
    const sharedPlatformClient = {
      name: 'park 2',
      ownerDeployment: originalDeployment.id,
      static: true
    };
    const sharedPlatform = await platformController.createPlatform(sharedPlatformClient);

    // Add a sensor to this platform
    const sharedPlatformSensorClient = {
      hasDeployment: originalDeployment.id
    };
    let sharedPlatformSensor = await sensorController.createSensor(sharedPlatformSensorClient);
    sharedPlatformSensor = await sensorController.hostSensorOnPlatform(sharedPlatformSensor.id, sharedPlatform.id);    

    //------------------------
    // Sharee deployment
    //------------------------
    // Create a deployment we'll share a platform with
    const shareeDeploymentClient = {
      name: 'Deployment 2',
      createdBy: 'user-2'
    };
    const shareeDeployment = await deploymentController.createDeployment(shareeDeploymentClient);

    //------------------------
    // Non-sharee deployment
    //------------------------
    // Create a deployment that have a platform shared with it
    const nonShareeDeploymentClient = {
      name: 'Deployment 3',
      createdBy: 'user-3'
    };
    const nonShareeDeployment = await deploymentController.createDeployment(nonShareeDeploymentClient);

    // Create a platform in the nonShareeDeployment that we'll later host on a platform in the original deployment
    const externalPlatformClient = {
      name: 'Stevenson Screen',
      ownerDeployment: nonShareeDeployment.id,
      static: false
    };
    const externalPlatform = await platformController.createPlatform(externalPlatformClient);

    // Create a sensor hosted on this platform
    const externalPlatformSensorClient = {
      name: 'Mercury Thermometer',
      hasDeployment: nonShareeDeployment.id
    };
    let externalPlatformSensor = await sensorController.createSensor(externalPlatformSensorClient);

    externalPlatformSensor = await sensorController.hostSensorOnPlatform(externalPlatformSensor.id, externalPlatform.id);

    // Check this sensor's context is as expected
    const externalPlatformSensorContext = await contextService.getLiveContextForSensor(externalPlatformSensor.id);
    expect(externalPlatformSensorContext).toMatchObject({
      hostedByPath: [externalPlatform.id],
      inDeployments: [nonShareeDeployment.id]
    });

    // Create a standalone sensor
    const standaloneSensorClient = {
      hasDeployment: nonShareeDeployment.id
    };
    const standaloneSensor = await sensorController.createSensor(standaloneSensorClient);

    //------------------------
    // Share platform
    //------------------------
    // Let's share the platform with another deployment
    await platformController.sharePlatformWithDeployment(sharedPlatform.id, shareeDeployment.id);
    // Let's check the context has updated for this platforms sensor
    const sharedSensorContext = await contextService.getLiveContextForSensor(sharedPlatformSensor.id);
    expect(sharedSensorContext).toMatchObject({
      hostedByPath: [sharedPlatform.id],
      inDeployments: [originalDeployment.id, shareeDeployment.id]
    });

    //------------------------
    // Host external platform
    //------------------------
    // Let's host a platform from the nonShareeDeployment on a platform from the original network
    const updatedExternalPlatform = await platformController.rehostPlatform(externalPlatform.id, nonSharedPlatform.id);
    // Let's check the updated platform's host details
    expect(updatedExternalPlatform.isHostedBy).toBe(nonSharedPlatform.id);
    expect(updatedExternalPlatform.hostedByPath).toEqual([nonSharedPlatform.id]);

    // Check context of the external sensor on this platform is correct
    const updatedExternalPlatformSensorContext = await contextService.getLiveContextForSensor(externalPlatformSensor.id);
    expect(updatedExternalPlatformSensorContext).toMatchObject({
      hostedByPath: [nonSharedPlatform.id, externalPlatform.id],
      inDeployments: [nonShareeDeployment.id]
      // Note how the sensor doesn't end up "in" the original deployment, merely its hosted on the deployment's platform. It would only end up "in" when the host platform is shared with the new deployment.
    });

    //------------------------
    // Host standalone sensor
    //------------------------
    // Host the standalone sensor on the platform in the original network
    const hostedStandaloneSensor = await sensorController.hostSensorOnPlatform(standaloneSensor.id, nonSharedPlatform.id);
    expect(hostedStandaloneSensor.isHostedBy).toBe(nonSharedPlatform.id);
    // Check the context has updated
    const hostedStandaloneSensorContext = await contextService.getLiveContextForSensor(standaloneSensor.id);
    expect(hostedStandaloneSensorContext).toMatchObject({
      hostedByPath: [nonSharedPlatform.id],
      inDeployments: [nonShareeDeployment.id]
      // Note how the sensor doesn't end up "in" the original deployment, merely its hosted on the deployment's platform.
    });

    //------------------------
    // Make private
    //------------------------
    // Now to make the deployment private
    const updatedOriginalDeployment = await deploymentController.updateDeployment(originalDeployment.id, {public: false});
    expect(updatedOriginalDeployment.public).toBe(false);

    // The external platform should no longer be hosted on the original deployment's platform
    const unhostedExternalPlatform = await platformController.getPlatform(externalPlatform.id);
    expect(unhostedExternalPlatform.isHostedBy).toBeUndefined();
    expect(unhostedExternalPlatform.hostedByPath).toBeUndefined();

    // Its sensor's context should also reflect this
    const unhostedExternalSensorContext = await contextService.getLiveContextForSensor(externalPlatformSensor.id);
    expect(unhostedExternalSensorContext).toMatchObject({
      hostedByPath: [externalPlatform.id],
      inDeployments: [nonShareeDeployment.id]
    });

    // The shared platform should still have the shareeDeployment listed
    const sharedPlatformAfterPrivate = await platformController.getPlatform(sharedPlatform.id);
    expect(sharedPlatformAfterPrivate.inDeployments).toEqual([originalDeployment.id, shareeDeployment.id]);

    // As should the context for the sensor hosted on the shared platform
    const sharedPlatformSensorAfterPrivate = await contextService.getLiveContextForSensor(sharedPlatformSensor.id);
    expect(sharedPlatformSensorAfterPrivate.inDeployments).toEqual([originalDeployment.id, shareeDeployment.id]);

    // The standalone sensor should now be unhosted
    const unhostedStandaloneSensor = await sensorController.getSensor(standaloneSensor.id);
    expect(unhostedStandaloneSensor.isHostedBy).toBeUndefined();
    // Check it's context too
    const unhostedStandaloneSensorContext = await contextService.getLiveContextForSensor(standaloneSensor.id);
    expect(unhostedStandaloneSensorContext.inDeployments).toEqual([nonShareeDeployment.id]);
    expect(unhostedStandaloneSensorContext.hostedByPath).toBeUndefined();

  });



});