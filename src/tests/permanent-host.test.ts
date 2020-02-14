import {disconnectDb, connectDb} from '../db/mongodb-service';
import * as logger from 'node-logger';
import {config} from '../config';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as permanentHostController from '../components/permanent-host/permanent-host.controller';
import * as check from 'check-types';
import {PermanentHostNotFound} from '../components/permanent-host/errors/PermanentHostNotFound';


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


});