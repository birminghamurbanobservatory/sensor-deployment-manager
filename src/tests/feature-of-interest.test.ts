import {disconnectDb, connectDb} from '../db/mongodb-service';
import * as logger from 'node-logger';
import {config} from '../config';
import * as MongodbMemoryServer from 'mongodb-memory-server';
import * as featureOfInterestController from '../components/feature-of-interest/feature-of-interest.controller';
import * as check from 'check-types';
import {FeatureOfInterestNotFound} from '../components/feature-of-interest/errors/FeatureOfInterestNotFound';



describe('Feature of interest tests', () => {

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

    expect.assertions(21);

    //------------------------
    // Create
    //------------------------
    const featureOfInterestClient = {
      id: 'earth-atmosphere',
      label: 'Earth Atmosphere',
      description: `The Earth's atmosphere`,
      location: {
        geometry: {
          type: 'Polygon',
          coordinates: [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]]
        }
      }
    };

    const createdFeatureOfInterest = await featureOfInterestController.createFeatureOfInterest(featureOfInterestClient);

    //------------------------
    // Read single
    //------------------------
    const featureOfInterest = await featureOfInterestController.getFeatureOfInterest(createdFeatureOfInterest.id);
    expect(featureOfInterest.id).toBe(featureOfInterestClient.id);
    expect(featureOfInterest.listed).toBe(true);
    expect(featureOfInterest.inCommonVocab).toBe(false);
    expect(featureOfInterest.belongsToDeployment).toBeUndefined();
    expect(featureOfInterest.createdBy).toBeUndefined();
    expect(check.nonEmptyString(featureOfInterest.location.validAt)).toBe(true);
    expect(featureOfInterest.location.geometry).toEqual(featureOfInterestClient.location.geometry);
    expect(featureOfInterest.location.centroid).toEqual({
      type: 'Point',
      coordinates: [15, 15]
    });
    expect(featureOfInterest.location.height).toBeUndefined();
    expect(check.nonEmptyString(featureOfInterest.createdAt)).toBe(true);
    expect(check.nonEmptyString(featureOfInterest.updatedAt)).toBe(true);


    //------------------------
    // Read multiple
    //------------------------
    const {data: featureOfInterests} = await featureOfInterestController.getFeaturesOfInterest({});
    expect(featureOfInterests.length).toBe(1);
    expect(featureOfInterests).toEqual([featureOfInterest]);
    

    //------------------------
    // Update
    //------------------------
    const updates = {
      description: 'The vast earth atmosphere',
      location: {
        geometry: {
          type: 'LineString',
          coordinates: [[10, 10], [20, 20], [30, 30]]
        },
        height: 500
      }
    };
    const updatedFeatureOfInterest = await featureOfInterestController.updateFeatureOfInterest(featureOfInterest.id, updates);
    expect(updatedFeatureOfInterest.description).toBe(updates.description);
    expect(updatedFeatureOfInterest.location.geometry).toEqual(updates.location.geometry);
    expect(updatedFeatureOfInterest.location.centroid).toEqual({
      type: 'Point',
      coordinates: [20, 20]
    });
    expect(updatedFeatureOfInterest.location.height).toBe(updates.location.height);
    // The location id should have changes
    expect(updatedFeatureOfInterest.location.id).not.toBe(featureOfInterest.location.id);
    expect(updatedFeatureOfInterest.location.validAt).not.toBe(featureOfInterest.location.validAt);


    //-------------------------------------------------
    // Delete
    //-------------------------------------------------
    await featureOfInterestController.deleteFeatureOfInterest(featureOfInterest.id);

    // Try getting the deleted featureOfInterest
    await expect(featureOfInterestController.getFeatureOfInterest(featureOfInterest.id)).rejects.toThrow(FeatureOfInterestNotFound);

    // Try getting all
    const {data: featureOfInterestsAfterDelete} = await featureOfInterestController.getFeaturesOfInterest({});
    expect(featureOfInterestsAfterDelete.length).toBe(0);


  });


});