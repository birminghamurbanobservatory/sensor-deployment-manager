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


describe('Location observations are correctly processed by the addContextToObservation function', () => {

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


  test('Location obs correctly keep platform locations up to date', async () => {

    expect.assertions(22);

    // Create a deployment
    const deploymentClient = {
      id: 'deployment-1',
      name: 'Deployment 1',
      description: 'My first deployment',
      createdBy: 'user-1'
    };

    const primaryDeployment = await deploymentController.createDeployment(deploymentClient);    

    // Create a sensor
    const sensorClient = {
      inDeployment: primaryDeployment.id,
      defaults: [
        {observedProperty: 'location'}
      ]
    };

    const sensor = await sensorController.createSensor(sensorClient);

    // Create a platform
    const platformClient = {
      id: 'van-123',
      name: 'Mobile van 123',
      static: false,
      ownerDeployment: primaryDeployment.id
    };

    const platform = await platformController.createPlatform(platformClient);

    // Host the sensor on the platform
    await sensorController.hostSensorOnPlatform(sensor.id, platform.id);

    // Update the platform so that it updates its location with this sensor
    const updatedPlatform = await platformController.updatePlatform(platform.id, {updateLocationWithSensor: sensor.id});

    expect(updatedPlatform.updateLocationWithSensor).toBe(sensor.id);

    // Ask to add context to a new observation from the sensor.
    const observation1Client = {
      madeBySensor: sensor.id,
      resultTime: new Date().toISOString(),
      hasResult: {
        value: {
          type: 'Point',
          coordinates: [-1.9, 52.5]
        }
      }
    };

    const observation1 = await addContextToObservation(observation1Client);

    // Check this observation now has a location
    expect(observation1).toHaveProperty('location');
    expect(observation1.location).toHaveProperty('id');
    expect(observation1.location.validAt).toBe(observation1Client.resultTime);
    expect(observation1.location.geometry).toEqual({
      type: 'Point',
      coordinates: [-1.9, 52.5]
    });
    expect(observation1).toHaveProperty('inDeployments');

    // Check it has updated the location of the platform
    const platformAfterObs1 = await platformController.getPlatform(platform.id);
    expect(platformAfterObs1.location).toEqual(observation1.location);

    // Now let's try another observation at a later date.
    const observation2Client = {
      madeBySensor: sensor.id,
      resultTime: (new Date((((new Date(observation1.location.validAt)).getTime()) + 3))).toISOString(),
      hasResult: {
        value: {
          type: 'Point',
          coordinates: [-1.94, 52.7] // different location
        }
      }
    };    

    const observation2 = await addContextToObservation(observation2Client);
    expect(observation2).toHaveProperty('location');
    expect(observation2.location).toHaveProperty('id');    
    expect(observation2.location.validAt).toBe(observation2Client.resultTime);
    expect(observation2.location.geometry).toEqual({
      type: 'Point',
      coordinates: [-1.94, 52.7]
    });  
    expect(observation2).toHaveProperty('inDeployments');  

    // Check it has updated the location of the platform
    const platformAfterObs2 = await platformController.getPlatform(platform.id);
    expect(platformAfterObs2.location).toEqual(observation2.location);

    // Now for a observation that's earlier than the last one to make sure this does NOT update the platform's location.
    const observation3Client = {
      madeBySensor: sensor.id,
      resultTime: (new Date((((new Date(observation1.location.validAt)).getTime()) + 1))).toISOString(),
      hasResult: {
        value: {
          type: 'Point',
          coordinates: [-1.95, 52.8] // different location
        }
      }
    };

    const observation3 = await addContextToObservation(observation3Client);
    expect(observation3).toHaveProperty('location');
    expect(observation3.location).toHaveProperty('id');    
    expect(observation3.location.validAt).toBe(observation3Client.resultTime);
    expect(observation3.location.geometry).toEqual({
      type: 'Point',
      coordinates: [-1.95, 52.8]
    });     
    expect(observation3).toHaveProperty('inDeployments');

    const platformAfterObs3 = await platformController.getPlatform(platform.id);
    expect(platformAfterObs3.location).toEqual(observation2.location); // should still be from obs2, not obs3.


    // Now to try one that's before we even had an context for this sensor
    const observation4Client = {
      madeBySensor: sensor.id,
      resultTime: (new Date(new Date().getTime() - 100000)).toISOString(),
      hasResult: {
        value: {
          type: 'Point',
          coordinates: [-1.96, 52.9] // different location
        }
      }
    };

    const observation4 = await addContextToObservation(observation4Client);
    // this observation won't have a location property, because we don't know for sure that this observation's observedProperty is location, because there will be no context tell us so, nor is it set in the original observation.
    expect(observation4).not.toHaveProperty('location');
    // It should not have a inDeployments property, as no context should have been found.
    expect(observation4).not.toHaveProperty('inDeployments');

    const platformAfterObs4 = await platformController.getPlatform(platform.id);
    expect(platformAfterObs4.location).toEqual(observation2.location); // should still be from obs2, not obs4.


  });


  // Try another test where observations from both a non-location, and a location sensor are coming in, i.e. to check the non-location obs get the location of the location sensor.
  test('Test alternating obs from non-location and location sensors on same platform', async () => {

    expect.assertions(7);

    // Create a Deployment
    const deploymentClient = {
      name: 'Mobile AQ Fleet',
      users: [{id: 'bob', level: 'admin'}]
    };

    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Create a permanent host
    const permanentHostClient = {
      name: 'Earthsense Zephyr 123'
    };
    const permanentHost = await permanentHostController.createPermanentHost(permanentHostClient);

    // Create a location sensor on this permanent host
    const exampleObservedPropertyForLocationSensor = 'location';
    const locationSensorClient = {
      name: 'Zephyr 123 GPS Sensor',
      permanentHost: permanentHost.id,
      defaults: [
        {observedProperty: exampleObservedPropertyForLocationSensor}
      ]
    };
    const locationSensor = await sensorController.createSensor(locationSensorClient);    

    // Create a non-location sensor on this permanent host
    const exampleObservedPropertyForNonLocationSensor = 'no2-concentration';
    const nonLocationSensorClient = {
      name: 'Zephyr 123 NO2 Sensor',
      permanentHost: permanentHost.id,
      defaults: [
        {observedProperty: exampleObservedPropertyForNonLocationSensor}
      ]
    };
    const nonLocationSensor = await sensorController.createSensor(nonLocationSensorClient);

    await permanentHostController.updatePermanentHost(permanentHost.id, {updateLocationWithSensor: locationSensor.id});

    // Add the permanent host to the deployment, which creates a platform in the process.
    const platform = await register(permanentHost.registrationKey, deployment.id);
    // Check that this platform inherited the permanentHost's updateLocationWithSensor property.
    expect(platform.updateLocationWithSensor).toBe(locationSensor.id);

    const firstObsDate = new Date();

    // First location observation
    const locObs1Client = {
      madeBySensor: locationSensor.id,
      hasResult: {
        value: {
          type: 'Point',
          coordinates: [-1.90, 52.0]
        } 
      },
      resultTime: firstObsDate.toISOString()
    };

    const locObs1 = await addContextToObservation(locObs1Client);
    expect(locObs1).toHaveProperty('location');
    expect(locObs1.location).toHaveProperty('id');
    const locObs1LocationId = locObs1.location.id;
    expect(locObs1).toEqual(Object.assign({}, locObs1Client, {
      inDeployments: [deployment.id],
      hostedByPath: [platform.id],
      observedProperty: exampleObservedPropertyForLocationSensor,
      location: {
        id: locObs1LocationId,
        geometry: locObs1Client.hasResult.value,
        validAt: locObs1Client.resultTime
      }
    }));

    // The platform should now have this location applied
    const platformAfterLocObs1 = await platformController.getPlatform(platform.id);
    expect(platformAfterLocObs1.location).toEqual(locObs1.location);

    // First non-location obs
    const nonLocObs1Client = {
      madeBySensor: nonLocationSensor.id,
      hasResult: {
        value: 899
      },
      resultTime: firstObsDate.toISOString() // let's set this as the same time as the location obs
    };

    const nonLocObs1 = await addContextToObservation(nonLocObs1Client);
    expect(nonLocObs1).toEqual(Object.assign({}, nonLocObs1Client, {
      inDeployments: [deployment.id],
      hostedByPath: [platform.id],
      observedProperty: exampleObservedPropertyForNonLocationSensor,
      location: locObs1.location // should match that of the location obs
    }));

    
    // Second location obs
    const locObs2Client = {
      madeBySensor: locationSensor.id,
      hasResult: {
        value: {
          type: 'Point',
          coordinates: [-1.91, 52.1]
        } 
      },
      resultTime: (new Date(firstObsDate.getTime() + 50)).toISOString()
    };
 
    const locObs2 = await addContextToObservation(locObs2Client);

    // Second non-location obs
    const nonLocObs2Client = {
      madeBySensor: nonLocationSensor.id,
      hasResult: {
        value: 900
      },
      resultTime: (new Date(firstObsDate.getTime() + 60)).toISOString() // let's go a tiny bit after
    };

    const nonLocObs2 = await addContextToObservation(nonLocObs2Client);
    expect(nonLocObs2).toEqual(Object.assign({}, nonLocObs2Client, {
      inDeployments: [deployment.id],
      hostedByPath: [platform.id],
      observedProperty: exampleObservedPropertyForNonLocationSensor,
      location: locObs2.location // should match that of the second location obs
    }));

    // Third non-location obs
    // This obs will have a resultTime before the validAt time of the platform location, however it will still inherit the latest location.
    // TODO


  });



});