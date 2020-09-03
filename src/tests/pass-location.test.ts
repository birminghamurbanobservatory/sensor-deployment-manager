import {config} from '../config';
import * as logger from 'node-logger';
import {connectDb, disconnectDb} from '../db/mongodb-service';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as sensorController from '../components/sensor/sensor.controller';
import * as permanentHostController from '../components/permanent-host/permanent-host.controller';
import * as deploymentController from '../components/deployment/deployment.controller';
import * as platformController from '../components/platform/platform.controller';
import * as check from 'check-types';
import {register} from '../components/registration/registration.controller';
import {addContextToObservation} from '../components/context/context.controller';
import {cloneDeep} from 'lodash';
import * as observablePropertyController from '../components/observable-property/observable-property.controller';



describe('Check that the passLocationToObservations property has the expected affect', () => {

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


  test('Check a platform with passLocationToObservations=false does NOT pass its location to an observation', async () => {
    
    expect.assertions(2);

    // Create a permanent host
    const permanentHost = {
      label: 'Radar platform',
      passLocationToObservations: false
    };
    const createdPermanentHost = await permanentHostController.createPermanentHost(permanentHost);

    // Need to create the following before the sensor can be created
    await observablePropertyController.createObservableProperty({id: 'PrecipitationRate'});

    // Create a sensor
    const sensorClient = {
      id: 'doppler-radar',
      label: 'Doppler radar 123',
      permanentHost: createdPermanentHost.id,
      initialConfig: [
        {
          hasPriority: true,
          observedProperty: 'PrecipitationRate'
        }
      ]
    };
    const sensor = await sensorController.createSensor(sensorClient);
    
    // Create a deployment
    const deploymentClient = {
      id: 'my-deployment',
      label: 'My Deployment'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Now to add the permanentHost (with its sensor) to a deployment.
    const platformClient = await register(createdPermanentHost.registrationKey, deployment.id);

    // Let's give this platform a location
    const platformWithLocation = await platformController.updatePlatform(platformClient.id, {
      location: {
        geometry: {
          type: 'Point',
          coordinates: [-1.92, 52.6]
        }
      }
    });

    // Try giving an observation without any location some context and check it doesn't have a location added.
    const locationlessObsWithoutContext = {
      madeBySensor: sensor.id,
      hasResult: {
        value: 22.6
      },
      resultTime: new Date().toISOString()
    };
    const locationlessObsWithContext = await addContextToObservation(locationlessObsWithoutContext);
    expect(locationlessObsWithContext.location).toBeUndefined();

    // Now try giving an observation with a location some context and check it keeps its original location.
    const obsWithLocationWithoutContext = {
      madeBySensor: sensor.id,
      hasResult: {
        value: 22.6
      },
      location: {
        id: '9c3c3bf0-4680-486f-bd8c-7a1a5d41b30a',
        validAt: '2020-09-02T17:36:19.942Z',
        geometry: {
          type: 'Point',
          coordinates: [-1.8, 53.0]
        }
      },
      resultTime: new Date().toISOString()
    };
    const obsWithLocationWithContext = await addContextToObservation(obsWithLocationWithoutContext);
    expect(obsWithLocationWithContext.location).toEqual(obsWithLocationWithoutContext.location);

  });



  test('Check a platform with passLocationToObservations=true DOES pass its location to an observation', async () => {
    
    expect.assertions(3);

    // Create a permanent host
    const permanentHost = {
      label: 'Wintersensor (345DE4)',
      passLocationToObservations: true,
      static: false
    };
    const createdPermanentHost = await permanentHostController.createPermanentHost(permanentHost);

    // Need to create the following before the sensor can be created
    await observablePropertyController.createObservableProperty({id: 'road-surface-temperature'});

    // Create a sensor
    const sensorClient = {
      id: 'wintersensor-345de4-infrared',
      label: 'Infrared sensor',
      permanentHost: createdPermanentHost.id,
      initialConfig: [
        {
          hasPriority: true,
          observedProperty: 'road-surface-temperature'
        }
      ]
    };
    const sensor = await sensorController.createSensor(sensorClient);
    
    // Create a deployment
    const deploymentClient = {
      id: 'my-deployment',
      label: 'My Deployment'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Now to add the permanentHost (with its sensor) to a deployment.
    const mobilePlatform = await register(createdPermanentHost.registrationKey, deployment.id);

    // Let's create a static platform to host this mobile platform on
    const staticPlatformClient = {
      id: 'lamppost-123',
      label: 'Lamppost 123',
      inDeployment: deployment.id,
      passLocationToObservations: true,
      static: true,
      location: {
        geometry: {
          type: 'Point',
          coordinates: [-1.92, 52.6]
        }
      }
    };
    const staticPlatform = await platformController.createPlatform(staticPlatformClient);

    // Perform the host
    const rehostedMobilePlatform = await platformController.rehostPlatform(mobilePlatform.id, staticPlatform.id);
    expect(rehostedMobilePlatform.location).toEqual(staticPlatform.location);

    // Try giving an observation without any location some context and check it adds the location
    const locationlessObsWithoutContext = {
      madeBySensor: sensor.id,
      hasResult: {
        value: 22.6
      },
      resultTime: new Date().toISOString()
    };
    const locationlessObsWithContext = await addContextToObservation(locationlessObsWithoutContext);
    expect(locationlessObsWithContext.location).toEqual(staticPlatform.location);

    // Now try giving an observation with a location some context and check the location is overwritten.
    const obsWithLocationWithoutContext = {
      madeBySensor: sensor.id,
      hasResult: {
        value: 22.6
      },
      location: {
        id: '9c3c3bf0-4680-486f-bd8c-7a1a5d41b30a',
        validAt: '2020-09-02T17:36:19.942Z',
        geometry: {
          type: 'Point',
          coordinates: [-1.8, 53.0]
        }
      },
      resultTime: new Date().toISOString()
    };
    const obsWithLocationWithContext = await addContextToObservation(obsWithLocationWithoutContext);
    expect(obsWithLocationWithContext.location).toEqual(staticPlatform.location);

  });



  test('Check that passLocationToObservations and updateLocationWithSensor work as expected in combination', async () => {
    
    expect.assertions(4);

    // Create a deployment
    const deploymentClient = {
      id: 'my-deployment',
      label: 'My Deployment'
    };
    const deployment = await deploymentController.createDeployment(deploymentClient);

    // Create a mobile platform in that deployment
    const platformClient = {
      id: 'van-2',
      label: 'Second van',
      inDeployment: deployment.id,
      passLocationToObservations: true,
      static: false
    };
    const platform = await platformController.createPlatform(platformClient);

    // Create a non-gps sensor on this platform
    const nonGpsSensorClient = {
      id: 'van-2-thermistor',
      label: 'Van 2 thermistor',
      isHostedBy: platform.id,
      inDeployment: deployment.id,
      initialConfig: [
        {
          hasPriority: true,
          observedProperty: 'air-temperature'
        }
      ]
    };
    const nonGpsSensor = await sensorController.createSensor(nonGpsSensorClient);

    // Create a gps sensor on this platform
    const gpsSensorClient = {
      id: 'van-2-gps',
      label: 'Van 2 GPS',
      isHostedBy: platform.id,
      inDeployment: deployment.id,
      initialConfig: [
        {
          hasPriority: true,
          observedProperty: 'location'
        }
      ]
    };
    const gpsSensor = await sensorController.createSensor(gpsSensorClient);

    // Update the platform so that it updates it's location using the gps sensor location observations
    const platformUpdate1 = await platformController.updatePlatform(platform.id, {updateLocationWithSensor: gpsSensor.id});

    const obs1WithoutContext = {
      madeBySensor: nonGpsSensor.id,
      hasResult: {
        value: 22.6
      },
      observedProperty: 'air-temperature',
      resultTime: new Date().toISOString()
    };

    const obs1WithContext = await addContextToObservation(obs1WithoutContext);
    // There's no location that can be added yet
    expect(obs1WithContext.location).toBeUndefined();

    // Now it's time for a gps observation
    const obs2WithoutContext = {
      madeBySensor: nonGpsSensor.id,
      hasResult: {
        value: {
          type: 'Point',
          coordinates: [-1.92, 52.5] 
        },
        unit: 'geojson-geometry'
      },
      location: {
        id: '0eaab0b1-236d-4f65-8742-4b640782ffc2',
        validAt: '2020-09-02T16:00:00.942Z',
        geometry: {
          type: 'Point',
          coordinates: [-1.92, 52.5] 
        }
      },
      observedProperty: 'location',
      resultTime: new Date().toISOString()
    };

    const obs2WithContext = await addContextToObservation(obs2WithoutContext);
    // The observation should keep its location
    expect(obs2WithContext.location).toEqual(obs2WithoutContext.location);

    // The platform location should now be updated
    const platformUpdate2 = await platformController.getPlatform(platform.id);
    expect(platformUpdate2.location).toEqual(obs2WithoutContext.location);

    // Now if we process an observation from the non-gps sensor, it should be passed the platform's new location
    const obs3WithoutContext = {
      madeBySensor: nonGpsSensor.id,
      hasResult: {
        value: 21.3
      },
      observedProperty: 'air-temperature',
      resultTime: new Date().toISOString()
    };
    const obs3WithContext = await addContextToObservation(obs3WithoutContext);
    expect(obs3WithContext.location).toEqual(obs2WithoutContext.location);

  });



});