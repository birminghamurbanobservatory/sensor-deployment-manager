import {config} from '../config';
import * as logger from 'node-logger';
import {connectDb, disconnectDb} from '../db/mongodb-service';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as contextService from '../components/context/context.service';
import * as platformController from '../components/platform/platform.controller';
import * as deploymentController from '../components/deployment/deployment.controller';
import * as platformService from '../components/platform/platform.service';
import {cloneDeep} from 'lodash';


describe('Testing context features', () => {

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


  test('Can handle populating the hostedByPath', async () => {
    
    expect.assertions(2);

    const dep1Client = {
      id: 'dep-1',
      label: 'Deployment 1'
    };
    const dep1 = await deploymentController.createDeployment(dep1Client);

    const plat1Client = {
      id: 'plat-1',
      label: 'Building 1',
      inDeployment: 'dep-1',
      static: true,
      location: {
        geometry: {
          type: 'Point',
          coordinates: [-1.9, 52.5]
        }
      },
      passLocationToObservations: true
    };
    const plat1 = await platformController.createPlatform(plat1Client);
    const plat1App = await platformService.getPlatform(plat1.id);

    const plat2Client = {
      id: 'plat-2',
      label: 'wall-1',
      inDeployment: 'dep-1',
      static: true,
      location: {
        geometry: {
          type: 'Point',
          coordinates: [-1.901, 52.501]
        }
      },
      passLocationToObservations: true
    };
    const plat2 = await platformController.createPlatform(plat2Client);
    const plat2App = await platformService.getPlatform(plat2.id);

    const context = {
      sensor: 'sen-1',
      startDate: new Date('2020-09-03T15:23:00.000Z'),
      hasDeployment: 'dep-1',
      hostedByPath: ['plat-1', 'plat-2']
    };

    const createdContext = await contextService.createContext(context);

    // First let's get the context without the platforms populated
    const unpopulatedContext = await contextService.getContextForSensorAtTime('sen-1', new Date('2020-09-03T15:24:00.000Z'));
    expect(unpopulatedContext).toEqual(createdContext);

    // Now let's get it populated
    const populatedContext = await contextService.getContextForSensorAtTime('sen-1', new Date('2020-09-03T15:24:00.000Z'), {populatePlatforms: true});

    const expectedPopulatedContext = cloneDeep(createdContext);
    expectedPopulatedContext.hostedByPath = [
      {
        id: plat1Client.id,
        location: plat1App.location,
        passLocationToObservations: plat1Client.passLocationToObservations
      },
      {
        id: plat2Client.id,
        location: plat2App.location,
        passLocationToObservations: plat2Client.passLocationToObservations
      }
    ];
    expect(populatedContext).toEqual(expectedPopulatedContext);

  });



  test('When creating a context with no hostedByPath make sure it defaults to undefined', async () => {
    
    const context = {
      sensor: 'sen-1',
      startDate: new Date('2020-09-03T15:23:00.000Z'),
      hasDeployment: 'dep-1',
    };

    const createdContext = await contextService.createContext(context);

    expect(createdContext.hostedByPath).toBeUndefined();

  });


});