import {disconnectDb, connectDb} from '../db/mongodb-service';
import * as logger from 'node-logger';
import {config} from '../config';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as check from 'check-types';
import * as sensorController from '../components/sensor/sensor.controller';
import * as permanentHostController from '../components/permanent-host/permanent-host.controller';
import * as deploymentController from '../components/deployment/deployment.controller';
import * as platformController from '../components/platform/platform.controller';
import {Forbidden} from '../errors/Forbidden';
import {register} from '../components/registration/registration.controller';
import {ObservablePropertyNotFound} from '../components/observable-property/errors/ObservablePropertyNotFound';


describe('Sensor testing', () => {

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


  test('A sensor on a permanentHost is correctly added and removed from a deployment', async () => {

    expect.assertions(14);

    // Create a sensor
    const sensorClient = {
      id: 'sensor-123'
    };
    const sensor = await sensorController.createSensor(sensorClient);

    // Create a permanentHost
    const permanentHostClient = {
      id: 'p-host-123'
    };
    const permanentHost = await permanentHostController.createPermanentHost(permanentHostClient);

    // Add the sensor to this permanentHost
    const sensorOnPermHost = await sensorController.updateSensor(sensor.id, {permanentHost: permanentHost.id});
    expect(sensorOnPermHost.permanentHost).toBe(permanentHost.id);

    // Create a deployment
    const deploymentClient = {
      id: 'deployment-1',
      name: 'Deployment 1'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Make sure that this sensor can't now be added directly to a deployment
    try {
      await sensorController.updateSensor(sensor.id, {hasDeployment: deployment.id});
    } catch (err) {
      expect(err).toBeInstanceOf(Forbidden);
    }

    // Make sure this sensor can't be added directly to a platform
    // First create a platform
    const otherPlatformClient = {
      name: 'Platform 1',
      inDeployment: deployment.id
    };
    const otherPlatform = await platformController.createPlatform(otherPlatformClient);
    // Now try adding the sensor to it
    let errAddingPermanentlyHostedSensorToPlatform;
    try {
      await sensorController.updateSensor(sensor.id, {isHostedBy: otherPlatform.id});
    } catch (err) {
      errAddingPermanentlyHostedSensorToPlatform = err;
    }
    expect(errAddingPermanentlyHostedSensorToPlatform).toBeInstanceOf(Forbidden);

    // Make sure this sensor can't be added to both the platform and deployment in one action
    let errAddingPermanentlyHostedSensorToDeploymentAndPlatform;
    try {
      await sensorController.updateSensor(sensor.id, {isHostedBy: otherPlatform.id, hasDeployment: deployment.id});
    } catch (err) {
      errAddingPermanentlyHostedSensorToDeploymentAndPlatform = err;
    }
    expect(errAddingPermanentlyHostedSensorToDeploymentAndPlatform).toBeInstanceOf(Forbidden);

    // Let's add this permantly hosted sensor to the deployment by the appropriate mechanism (i.e. registration)
    const platform = await register(permanentHost.registrationKey, deployment.id);

    const sensorOnPlatform = await sensorController.getSensor(sensor.id);
    expect(sensorOnPlatform.hasDeployment).toBe(deployment.id);
    expect(sensorOnPlatform.isHostedBy).toBe(platform.id);
    expect(sensorOnPlatform.permanentHost).toBe(permanentHost.id);
    
    // Make sure the sensor can't be removed from its platform
    let errRemovingSensorStraightFromPlatform;
    try {
      await sensorController.updateSensor(sensor.id, {isHostedBy: null});
    } catch (err) {
      errRemovingSensorStraightFromPlatform = err;
    }
    expect(errRemovingSensorStraightFromPlatform).toBeInstanceOf(Forbidden);

    // Make sure the sensor can't be removed from the deployment by itself, it can only be removed when the whole platform is removed.
    let errRemovingSensorStraightFromDeployment;
    try {
      await sensorController.updateSensor(sensor.id, {hasDeployment: null});
    } catch (err) {
      errRemovingSensorStraightFromDeployment = err;
    }
    expect(errRemovingSensorStraightFromDeployment).toBeInstanceOf(Forbidden);

    // Make sure the sensor can't be removed from it's permanentHost at this point
    let errRemovingSensorFromPermanentHostWhilstOnPlatform;
    try {
      await sensorController.updateSensor(sensor.id, {permanentHost: null});
    } catch (err) {
      errRemovingSensorFromPermanentHostWhilstOnPlatform = err;
    }
    expect(errRemovingSensorFromPermanentHostWhilstOnPlatform).toBeInstanceOf(Forbidden);

    // Remove the sensor from the deployment by deleting the platform it's on. We'll test the 'releasing' approach in a different test.
    await platformController.deletePlatform(platform.id);

    // Make sure that the individual sensor now has its isHostedBy property unset.
    const sensorAfterRemoval = await sensorController.getSensor(sensor.id);
    expect(sensorAfterRemoval.permanentHost).toBe(permanentHost.id);
    expect(sensorAfterRemoval).not.toHaveProperty('hasDeployment');
    expect(sensorAfterRemoval).not.toHaveProperty('isHostedBy');

    // The sensor should be able to be unassigned from the permanentHost now that it's not in a deployment or on a platform.
    await sensorController.updateSensor(sensor.id, {permanentHost: null});

    const sensorAloneAgain = await sensorController.getSensor(sensor.id);
    expect(sensorAloneAgain).not.toHaveProperty('permanentHost'); 

  });



  test('A standalone sensor can be correctly added and removed to a deployment', async () => {

    expect.assertions(12);
    
    // Create a deployment
    const deploymentClient = {
      id: 'deployment-1',
      name: 'Deployment 1'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Create a platform
    const platformClient = {
      name: 'Platform 1',
      inDeployment: deployment.id
    };
    const platform = await platformController.createPlatform(platformClient);

    // Create a sensor
    const sensorClient = {
      id: 'sensor-123'
    };
    const sensor = await sensorController.createSensor(sensorClient);

    // Add the sensor to a deployment and platform in that deployment in a single update
    const sensorWithDeploymentAndPlatform = await sensorController.updateSensor(sensor.id, {
      hasDeployment: deployment.id,
      isHostedBy: platform.id
    });

    expect(sensorWithDeploymentAndPlatform.hasDeployment).toBe(deployment.id);
    expect(sensorWithDeploymentAndPlatform.isHostedBy).toBe(platform.id);
    expect(sensorWithDeploymentAndPlatform).not.toHaveProperty('permanentHost');
    
    // Make sure once it's in a deployment, it can't then be assigned to a permanent host.
    // First create a permanent host
    const permanentHostClient = {
      id: 'p-host-123'
    };
    const permanentHost = await permanentHostController.createPermanentHost(permanentHostClient);
    // Now try to add it to this permanenthost
    let errAssigningPermanentHost;
    try {
      await sensorController.updateSensor(sensor.id, {permanentHost: permanentHost.id});
    } catch (err) {
      errAssigningPermanentHost = err;
    }
    expect(errAssigningPermanentHost).toBeInstanceOf(Forbidden);

    // Allow the sensor to be in the deployment without a platform
    const sensorWithoutPlatform = await sensorController.updateSensor(sensor.id, {isHostedBy: null});
    expect(sensorWithoutPlatform.hasDeployment).toBe(deployment.id);
    expect(sensorWithoutPlatform).not.toHaveProperty('isHostedBy');
    
    // Check it can be hosted back on the platform within the deployment.
    const sensorBackOnPlatform = await sensorController.updateSensor(sensor.id, {isHostedBy: platform.id});
    expect(sensorBackOnPlatform.hasDeployment).toBe(deployment.id);
    expect(sensorBackOnPlatform.isHostedBy).toBe(platform.id);


    // Check it doesn't allow this sensor to change deployment if its platform remains in the first deployment
    const otherDeploymentClient = {
      id: 'deployment-2',
      name: 'Deployment 2'
    };
    const otherDeployment = await deploymentController.createDeployment(otherDeploymentClient);

    let errChangingDeploymentWithoutChangingPlatform;
    try {
      await sensorController.updateSensor(sensor.id, {hasDeployment: otherDeployment.id});
    } catch (err) {
      errChangingDeploymentWithoutChangingPlatform = err;
    }
    expect(errChangingDeploymentWithoutChangingPlatform).toBeInstanceOf(Forbidden);

    // If the user unsets the deployment whilst it remains hosted on a platform and error should occur
    let errUnsettingDeploymentWhilstHosted;
    try {
      await sensorController.updateSensor(sensor.id, {hasDeployment: null});
    } catch (err) {
      errUnsettingDeploymentWhilstHosted = err;
    }
    expect(errUnsettingDeploymentWhilstHosted).toBeInstanceOf(Forbidden);

    // Allow it to be unhosted and removed from a deployment in one go
    const sensorAloneAgain = await sensorController.updateSensor(sensor.id, {
      hasDeployment: null,
      isHostedBy: null
    });

    expect(sensorAloneAgain).not.toHaveProperty('hasDeployment');
    expect(sensorAloneAgain).not.toHaveProperty('isHostedBy');

  });



  test('Create a sensor that is within a deployment from creation', async () => {

    expect.assertions(3);
    
    // Create a deployment
    const deploymentClient = {
      id: 'deployment-1',
      name: 'Deployment 1'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Create a sensor in a deployment
    const sensorClient = {
      id: 'sensor-123',
      hasDeployment: deployment.id
    };
    const sensor = await sensorController.createSensor(sensorClient);

    expect(sensor.hasDeployment).toBe(deployment.id);
    expect(sensor).not.toHaveProperty('permanentHost');
    expect(sensor).not.toHaveProperty('isHostedBy');

  });


  test('Create a sensor that is within a deployment and on a platform from creation', async () => {

    expect.assertions(3);
    
    // Create a deployment
    const deploymentClient = {
      id: 'deployment-1',
      name: 'Deployment 1'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Create a platform
    const platformClient = {
      name: 'Platform 1',
      inDeployment: deployment.id
    };
    const platform = await platformController.createPlatform(platformClient);

    // Create sensor
    const sensorClient = {
      id: 'sensor-123',
      hasDeployment: deployment.id,
      isHostedBy: platform.id
    };
    const sensor = await sensorController.createSensor(sensorClient);

    expect(sensor.hasDeployment).toBe(deployment.id);
    expect(sensor.isHostedBy).toBe(platform.id);
    expect(sensor).not.toHaveProperty('permanentHost');

  });


  test(`Check sensors can be "released" from a platform`, async () => {

    expect.assertions(6);

    // Create a permanentHost
    const permanentHostClient = {
      id: 'p-host-123'
    };
    const permanentHost = await permanentHostController.createPermanentHost(permanentHostClient);

    // Create a sensor
    const sensorClient = {
      id: 'sensor-123',
      permanentHost: permanentHost.id
    };
    const sensor = await sensorController.createSensor(sensorClient);

    // Create a deployment
    const deploymentClient = {
      id: 'deployment-1',
      name: 'Deployment 1'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Register the permanent host to the deployment
    const platform = await register(permanentHost.registrationKey, deployment.id);
    expect(platform.inDeployment).toBe(deployment.id);

    // Now let's release the sensor from this platform
    await platformController.releasePlatformSensors(platform.id);

    // The platform should still be in this deployment
    const platformAfterRelease = await platformController.getPlatform(platform.id);
    expect(platformAfterRelease.inDeployment).toBe(deployment.id);

    // If we ask for a list of sensors on this platform we should get back none
    const {data: sensorsNowOnPlatform} = await sensorController.getSensors({isHostedBy: platform.id});
    expect(sensorsNowOnPlatform).toEqual([]);

    const releasedSensor = await sensorController.getSensor(sensor.id);
    expect(releasedSensor.permanentHost).toBe(permanentHost.id);
    expect(releasedSensor).not.toHaveProperty('hasDeployment');
    expect(releasedSensor).not.toHaveProperty('isHostedBy');

  });



  test(`Check that a "deployment sensor" can't be hosted on a platform initialised from permanentHost`, async () => {

    expect.assertions(1);

    // Create a permanentHost
    const permanentHostClient = {
      id: 'p-host-123'
    };
    const permanentHost = await permanentHostController.createPermanentHost(permanentHostClient);

    // Create a sensor for the permanent host
    const sensorWithPermanentHostClient = {
      id: 'sensor-123',
      permanentHost: permanentHost.id
    };
    await sensorController.createSensor(sensorWithPermanentHostClient);

    // Create a deployment
    const deploymentClient = {
      id: 'deployment-1',
      name: 'Deployment 1'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Register the permanent host to the deployment
    const platform = await register(permanentHost.registrationKey, deployment.id);

    // Create a "deployment sensor"
    const deploymentSensorClient = {
      id: 'sensor-456',
      hasDeployment: deployment.id
    };
    const deploymentSensor = await sensorController.createSensor(deploymentSensorClient);

    let errHostingDeploymentSensorOnInitialisedPlatform;
    try {
      await sensorController.updateSensor(deploymentSensor.id, {isHostedBy: platform.id});
    } catch (err) {
      errHostingDeploymentSensorOnInitialisedPlatform = err;
    }
    expect(errHostingDeploymentSensorOnInitialisedPlatform).toBeInstanceOf(Forbidden);

  });



  test('Will not let you create a sensor with a config that contains an ID that has not been defined yet', async() => {
    
    expect.assertions(1);

    // Create a "deployment sensor"
    const sensorClient = {
      id: 'sensor-456',
      initialConfig: [
        {
          hasPriority: true,
          observedProperty: 'UnknownProperty'
        }
      ]
    };

    let errCreatingSensor;
    try {
      await sensorController.createSensor(sensorClient);
    } catch (err) {
      errCreatingSensor = err;
    }
    expect(errCreatingSensor).toBeInstanceOf(ObservablePropertyNotFound);

  });

});





