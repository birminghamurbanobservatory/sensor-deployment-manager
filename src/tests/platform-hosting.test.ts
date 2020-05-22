import {config} from '../config';
import * as logger from 'node-logger';
import {connectDb, disconnectDb} from '../db/mongodb-service';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as sensorController from '../components/sensor/sensor.controller';
import * as permanentHostController from '../components/permanent-host/permanent-host.controller';
import * as deploymentController from '../components/deployment/deployment.controller';
import * as platformController from '../components/platform/platform.controller';
import {register} from '../components/registration/registration.controller';
import Context from '../components/context/context.model';
import {platform} from 'os';
import {PlatformNotFound} from '../components/platform/errors/PlatformNotFound';
import {getLiveContextForSensor} from '../components/context/context.service';


describe('Platform hosting tests', () => {

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


  test('A mobile platform (without a location sensor) can be hosted on and unhosted from a static platform', async () => {

    expect.assertions(11);

    // Create a deployment
    const deploymentClient = {
      id: 'climavue-weather-stations',
      name: 'Climavue Weather Stations'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Create a permanent host
    const permanentHostClient = {
      name: 'Climavue 123',
      description: 'Climavue weather station'
    };
    const permanentHost = await permanentHostController.createPermanentHost(permanentHostClient);

    // Create a sensor
    const sensorClient = {
      id: 'sensor-123',
      name: 'Sensor 123',
      permanentHost: permanentHost.id
    };
    const sensor = await sensorController.createSensor(sensorClient);

    // Register the permanent host to the deployment
    const hosteePlatform = await register(permanentHost.registrationKey, deployment.id);
    expect(hosteePlatform.static).toBe(false);

    // Create a host platform
    const hostPlatformClient = {
      name: 'Lighting Column no. 16',
      inDeployment: deployment.id,
      static: true,
      location: {
        geometry: {
          type: 'Point',
          coordinates: [-1.9, 52]
        }
      }
    };

    const hostPlatform = await platformController.createPlatform(hostPlatformClient);

    expect(hostPlatform).toHaveProperty('location');
    expect(hostPlatform.static).toBe(true);
    expect(typeof hostPlatform.location.id).toBe('string');
    expect(typeof hostPlatform.location.validAt).toBe('string');

    // Host one platform on the other
    const hostedPlatform = await platformController.rehostPlatform(hosteePlatform.id, hostPlatform.id);

    expect(hostedPlatform.isHostedBy).toBe(hostPlatform.id);
    expect(hostedPlatform.hostedByPath).toEqual([hostPlatform.id]);
    // Should inherit the location
    expect(hostedPlatform.location).toEqual(hostPlatform.location);

    // Now let's unhost it
    const unhostedPlatform = await platformController.unhostPlatform(hostedPlatform.id);
    expect(unhostedPlatform).not.toHaveProperty('isHostedBy');
    expect(unhostedPlatform).not.toHaveProperty('hostedByPath');
    // It'll still keep the inherited location
    expect(unhostedPlatform.location).toEqual(hostPlatform.location);

  });



  test('A mobile platform (WITH a location sensor) can be hosted on and unhosted from a mobile platform', async () => {

    expect.assertions(14);

    // Create a deployment
    const deploymentClient = {
      id: 'aq-vans',
      name: 'Air Quality Vans'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Create a permanent host
    const permanentHostClient = {
      name: 'Earthsense Zephyr serial no. 152342',
    };
    const permanentHost = await permanentHostController.createPermanentHost(permanentHostClient);

    // Create sensor 1
    const sensor1Client = {
      id: 'zephyr-152342-co2',
      name: 'Zephyr 152342 CO2 sensor',
      permanentHost: permanentHost.id
    };
    const sensor1 = await sensorController.createSensor(sensor1Client);

    // Create sensor 2
    const sensor2Client = {
      id: 'zephyr-152342-gps',
      name: 'Zephyr 152342 GPS sensor',
      permanentHost: permanentHost.id
    };
    const sensor2 = await sensorController.createSensor(sensor2Client);

    // Update the permanentHost so that it uses the gps sensor for updating the location
    const permanentHostUpdated = await permanentHostController.updatePermanentHost(permanentHost.id, {
      updateLocationWithSensor: sensor2.id
    });
    
    expect(permanentHostUpdated.updateLocationWithSensor).toBe(sensor2.id);

    // Register the permanent host to the deployment
    const hosteePlatform = await register(permanentHost.registrationKey, deployment.id);
    expect(hosteePlatform.static).toBe(false);
    expect(hosteePlatform.updateLocationWithSensor).toBe(sensor2.id);

    // Create a host platform
    const hostPlatformClient = {
      name: 'AQ Van No. 1',
      inDeployment: deployment.id,
      static: false
    };

    const hostPlatform = await platformController.createPlatform(hostPlatformClient);

    expect(hostPlatform).not.toHaveProperty('location');
    expect(hostPlatform.static).toBe(false);

    // Host one platform on the other
    const hostedPlatform = await platformController.rehostPlatform(hosteePlatform.id, hostPlatform.id);

    expect(hostedPlatform.isHostedBy).toBe(hostPlatform.id);
    expect(hostedPlatform.hostedByPath).toEqual([hostPlatform.id]);
    expect(hostedPlatform).not.toHaveProperty('location');

    // Get the hostPlatform again, because it should have been updated.
    const hostPlatformAfterRehost = await platformController.getPlatform(hostPlatform.id);
    expect(hostPlatformAfterRehost.updateLocationWithSensor).toBe(sensor2.id);
    // Because neither platform has a location yet, the location should not be set yet
    expect(hostPlatformAfterRehost).not.toHaveProperty('location');
    
    // Now let's unhost it
    const unhostedPlatform = await platformController.unhostPlatform(hostedPlatform.id);
    expect(unhostedPlatform).not.toHaveProperty('isHostedBy');
    expect(unhostedPlatform).not.toHaveProperty('hostedByPath');

    // We need to check that the host platform will no longer have its location updated by the sensor whose platform has just be unhosted.
    const hostPlatformAfterUnhost = await platformController.getPlatform(hostPlatform.id);
    expect(hostPlatformAfterUnhost).not.toHaveProperty('updateLocationWithSensor');

    // Let's also double check that the now unhostedPlatform does still have it's updateLocationWithSensor set
    const unhostedPlatformAgain = await platformController.getPlatform(hostedPlatform.id);
    expect(unhostedPlatformAgain.updateLocationWithSensor).toBe(sensor2.id);

  });



  test('Handles deleting a parent platform that has child platforms and sensors', async () => {
    
    expect.assertions(24);

    // Create a deployment
    const deploymentClient = {
      name: 'Uni Met Station'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Create parent platform
    const parentPlatformClient = {
      name: 'Met Enclosure',
      inDeployment: deployment.id
    };
    const parentPlatform = await platformController.createPlatform(parentPlatformClient);

    // Add a sensor to the parent platform
    const parentSensorClient = {
      name: 'pyranometer',
      hasDeployment: deployment.id,
      isHostedBy: parentPlatform.id
    };
    const parentSensor = await sensorController.createSensor(parentSensorClient); 

    // Create a child platform
    const stdChildPlatformClient = {
      name: 'Stevenson screen',
      isHostedBy: parentPlatform.id,
      inDeployment: deployment.id
    };
    const stdChildPlatform = await platformController.createPlatform(stdChildPlatformClient);

    // Add a sensor to this child platform
    const stdChildSensorClient = {
      name: 'mercury-thermometer',
      hasDeployment: deployment.id,
      isHostedBy: stdChildPlatform.id
    };
    const stdChildSensor = await sensorController.createSensor(stdChildSensorClient); 

    // Create a permanent host
    const permanentHostClient = {
      name: 'climavue50'
    }; 
    const permanentHost = await permanentHostController.createPermanentHost(permanentHostClient);

    // Create a sensor on the permanentHost
    const pHostSensorClient = {
      id: 'phost-1-sensor-1',
      name: 'thermometer',
      permanentHost: permanentHost.id
    };  
    const pHostSensor = await sensorController.createSensor(pHostSensorClient);

    // Register the permanentHost to the deployment
    const pHostChildPlatform = await register(permanentHost.registrationKey, deployment.id);
    // Host this platform on parent platform
    const pHostChildPlatformUpdated = await platformController.rehostPlatform(pHostChildPlatform.id, parentPlatform.id);
    expect(pHostChildPlatformUpdated.isHostedBy).toBe(parentPlatform.id);
    expect(pHostChildPlatformUpdated.hostedByPath).toEqual([parentPlatform.id]);
    expect(pHostChildPlatformUpdated.topPlatform).toBe(parentPlatform.id);
    
    // Check we have created the right number of contexts
    // N.B. the sensor on the permanent host will have created 3 contexts thus far
    const contextsAlpha = await Context.find({}).exec();
    expect(contextsAlpha.length).toBe(5);

    // Now let's delete the parent platform
    await platformController.deletePlatform(parentPlatform.id);

    // Let's check it's definitely deleted
    let errGettingDeletedPlatform;
    try {
      await platformController.getPlatform(parentPlatform.id);
    } catch (err) {
      errGettingDeletedPlatform = err;
    }
    expect(errGettingDeletedPlatform).toBeInstanceOf(PlatformNotFound);

    // Check the sensor that was directly on the platform
    const parentSensorAfter = await sensorController.getSensor(parentSensor.id);
    expect(parentSensorAfter).not.toHaveProperty('isHostedBy');
    expect(parentSensorAfter.hasDeployment).toBe(deployment.id);
    // Check it's context too
    const parentSensorContextAfter = await getLiveContextForSensor(parentSensor.id);
    expect(parentSensorContextAfter.hasDeployment).toBe(deployment.id);
    expect(parentSensorAfter).not.toHaveProperty('hostedByPath');

    // Check standard child platfrom
    const stdChildPlatformAfter = await platformController.getPlatform(stdChildPlatform.id);
    expect(stdChildPlatformAfter).not.toHaveProperty('isHostedBy');
    expect(stdChildPlatformAfter).not.toHaveProperty('hostedByPath');
    expect(stdChildPlatformAfter.topPlatform).toBe(stdChildPlatform.id);
    // Check its sensor
    const stdChildSensorAfter = await sensorController.getSensor(stdChildSensor.id);
    expect(stdChildSensorAfter.isHostedBy).toBe(stdChildPlatform.id);
    expect(stdChildSensorAfter.hasDeployment).toBe(deployment.id);
    // Check its context
    const stdChildSensorContextAfter = await getLiveContextForSensor(stdChildSensor.id);
    expect(parentSensorContextAfter.hasDeployment).toBe(deployment.id);
    expect(stdChildSensorContextAfter.hostedByPath).toEqual([stdChildPlatform.id]);

    // Check on the platform from the permanent host
    const pHostChildPlatformAfter = await platformController.getPlatform(pHostChildPlatform.id);
    expect(pHostChildPlatformAfter.inDeployment).toBe(deployment.id);
    expect(pHostChildPlatformAfter).not.toHaveProperty('isHostedBy');
    expect(pHostChildPlatformAfter).not.toHaveProperty('hostedByPath');
    expect(pHostChildPlatformAfter.topPlatform).toBe(pHostChildPlatform.id);
    // Check on its sensor
    const pHostSensorAfter = await sensorController.getSensor(pHostSensor.id);
    expect(pHostSensorAfter.isHostedBy).toBe(pHostChildPlatform.id);
    expect(pHostSensorAfter.hasDeployment).toBe(deployment.id);
    // Check its context
    const pHostSensorContextAfter = await getLiveContextForSensor(pHostSensor.id);
    expect(pHostSensorContextAfter.hasDeployment).toBe(deployment.id);
    expect(pHostSensorContextAfter.hostedByPath).toEqual([pHostChildPlatform.id]);

  });


});


