import {config} from '../config';
import * as logger from 'node-logger';
import {connectDb, disconnectDb} from '../utils/db';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as deploymentController from '../components/deployment/deployment.controller';
import Deployment from '../components/deployment/deployment.model';



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
    
    // First we need to create a deployment
    const initialClientDeployment1 = {
      name: 'Deployment 1',
      createdBy: 'user-1'
    };

    const createdDeployment1 = await deploymentController.createDeployment(initialClientDeployment1);

    // Let's also set up a second deployment
    const initialClientDeployment2 = {
      name: 'Deployment 2',
      createdBy: 'user-2'
    };

    const createdDeployment2 = await deploymentController.createDeployment(initialClientDeployment2);

    // TODO
  

  });




});