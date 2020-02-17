import {disconnectDb, connectDb} from '../db/mongodb-service';
import * as logger from 'node-logger';
import {config} from '../config';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as permanentHostController from '../components/permanent-host/permanent-host.controller';
import * as check from 'check-types';
import {PermanentHostNotFound} from '../components/permanent-host/errors/PermanentHostNotFound';
import * as deploymentController from '../components/deployment/deployment.controller';
import * as sensorController from '../components/sensor/sensor.controller';
import * as platformController from '../components/platform/platform.controller';
import {register} from '../components/registration/registration.controller';
import {getLiveContextForSensor} from '../components/context/context.service';

describe('Permanent host testing', () => {

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

  test('CRUD workflow', async () => {

    expect.assertions(10);

    //------------------------
    // Create
    //------------------------

    const permanentHostClient = {
      name: 'Weather Station 5',
      description: 'A weather station with lots of intergrated sensors on it',
      static: false
    };

    const createdPermanentHost = await permanentHostController.createPermanentHost(permanentHostClient);

    //------------------------
    // Read single
    //------------------------
    const permanentHost = await permanentHostController.getPermanentHost(createdPermanentHost.id);
    expect(check.nonEmptyString(permanentHost.id)).toBe(true);
    expect(check.nonEmptyString(permanentHost.registrationKey)).toBe(true);
    expect(check.nonEmptyString(permanentHost.createdAt)).toBe(true);
    expect(check.nonEmptyString(permanentHost.updatedAt)).toBe(true);
    expect(permanentHost).toEqual({
      id: permanentHost.id,
      name: permanentHostClient.name,
      description: permanentHostClient.description,
      static: permanentHostClient.static,
      registrationKey: permanentHost.registrationKey,
      createdAt: permanentHost.createdAt,
      updatedAt: permanentHost.updatedAt
    });


    //------------------------
    // Read multiple
    //------------------------
    const permanentHosts = await permanentHostController.getPermanentHosts({});
    expect(permanentHosts.length).toBe(1);
    expect(permanentHosts).toEqual([permanentHost]);
    

    //------------------------
    // Update
    //------------------------
    const updates = {
      description: 'An updated description'
    };
    const updatedPermanentHost = await permanentHostController.updatePermanentHost(permanentHost.id, updates);
    expect(updatedPermanentHost.description).toBe(updates.description);

    //-------------------------------------------------
    // Delete
    //-------------------------------------------------
    await permanentHostController.deletePermanentHost(permanentHost.id);

    // Try getting the deleted permanentHost
    await expect(permanentHostController.getPermanentHost(permanentHost.id)).rejects.toThrow(PermanentHostNotFound);

    // Try getting all the permanentHosts
    const permanentHostsAfterDelete = await permanentHostController.getPermanentHosts({});
    expect(permanentHostsAfterDelete.length).toBe(0);


  });


  test('Registering and deregistering', async () => {

    expect.assertions(8);

    const permanentHostClient = {
      name: 'Weather Station 5',
      description: 'A weather station with lots of intergrated sensors on it',
      static: false
    };

    const permanentHost = await permanentHostController.createPermanentHost(permanentHostClient);

    expect(check.nonEmptyString(permanentHost.registrationKey)).toBe(true);
    expect(permanentHost.registeredAs).toBe(undefined);

    // Create a sensor on this permanent host
    const sensorClient = {
      id: 'sensor-123',
      name: 'Sensor 123',
      permanentHost: permanentHost.id,
      defaults: [
        {
          observedProperty: 'temperature'
        },
        {
          hasFeatureOfInterest: 'weather'
        }
      ]
    };
    const sensor = await sensorController.createSensor(sensorClient);

    // Create a deployment
    const deploymentClient = {
      id: 'my-deployment',
      name: 'My Deployment',
      users: [{id: 'bob', level: 'admin'}]
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Now to add the permanentHost to the deployment.
    const platform = await register(permanentHost.registrationKey, deployment.id);

    const registedPermanentHost = await permanentHostController.getPermanentHost(permanentHost.id);
    expect(registedPermanentHost.registeredAs).toBe(platform.id);

    // Let's check the sensor context looks right
    const registeredSensorContext = await getLiveContextForSensor(sensor.id);
    expect(registeredSensorContext.inDeployments).toEqual([deployment.id]);
    expect(registeredSensorContext.hostedByPath).toEqual([platform.id]);

    // Completely remove the platform from the deployment
    await platformController.deletePlatform(platform.id);

    const deregistedPermanentHost = await permanentHostController.getPermanentHost(permanentHost.id);
    expect(deregistedPermanentHost.registeredAs).toBe(undefined);

    // Let's also check the sensor context looks right
    const deregisteredSensorContext = await getLiveContextForSensor(sensor.id);
    expect(deregisteredSensorContext.inDeployments).toBe(undefined);
    expect(deregisteredSensorContext.hostedByPath).toBe(undefined);

  });


});