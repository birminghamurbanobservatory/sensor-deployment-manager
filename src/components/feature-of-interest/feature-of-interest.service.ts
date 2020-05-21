import {cloneDeep} from 'lodash';
import {renameProperty} from '../../utils/rename';
import {FeatureOfInterestApp, FeatureOfInterestLocation} from './feature-of-interest-app.class';
import {FeatureOfInterestClient} from './feature-of-interest-client.class';
import FeatureOfInterest from './feature-of-interest.model';
import {FeatureOfInterestAlreadyExists} from './errors/FeatureOfInterestAlreadyExists';
import {CreateFeatureOfInterestFail} from './errors/CreateFeatureOfInterestFail';
import {InvalidFeatureOfInterest} from './errors/InvalidFeatureOfInterest';
import {GetFeatureOfInterestFail} from './errors/GetFeatureOfInterestFail';
import {FeatureOfInterestNotFound} from './errors/FeatureOfInterestNotFound';
import {CollectionOptions} from '../common/collection-options.class';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import * as check from 'check-types';
import {GetFeaturesOfInterestFail} from './errors/GetFeaturesOfInterestFail';
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {UpdateFeatureOfInterestFail} from './errors/UpdateFeatureOfInterestFail';
import {DeleteFeatureOfInterestFail} from './errors/DeleteFeatureOfInterestFail';
import {v4 as uuid} from 'uuid';
import {calculateCentroidFromGeometry} from '../../utils/geojson-helpers';


export async function createFeatureOfInterest(featureOfInterest: FeatureOfInterestApp): Promise<FeatureOfInterestApp> {

  const featureOfInterestDb = featureOfInterestAppToDb(featureOfInterest);

  let created;
  try {
    created = await FeatureOfInterest.create(featureOfInterestDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new FeatureOfInterestAlreadyExists(`A featureOfInterest with an id of '${featureOfInterest.id}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidFeatureOfInterest(err.message);
    } else {
      throw new CreateFeatureOfInterestFail(undefined, err.message);
    }
  }

  return featureOfInterestDbToApp(created);

}



export async function getFeatureOfInterest(id, options: {includeDeleted?: boolean} = {}): Promise<FeatureOfInterestApp> {

  const findWhere: any = {_id: id};
  
  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  let found;
  try {
    found = await FeatureOfInterest.findOne(findWhere).exec();
  } catch (err) {
    throw new GetFeatureOfInterestFail(undefined, err.message);
  }

  if (!found) {
    throw new FeatureOfInterestNotFound(`A featureOfInterest with id '${id}' could not be found.`);
  }

  return featureOfInterestDbToApp(found);

}



export async function getFeaturesOfInterest(
  where: {
    id?: any; 
    listed?: boolean; 
    inCommonVocab?: boolean;
    createdBy?: string; 
    belongsToDeployment?: string; 
    search?: string;
  }, 
  options: CollectionOptions = {}
): Promise<{data: FeatureOfInterestApp[]; count: number; total: number}> {

  const findWhere = whereToMongoFind(where);

  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);

  let found;
  try {
    found = await FeatureOfInterest.find(findWhere, null, findOptions).exec();
  } catch (err) {
    throw new GetFeaturesOfInterestFail(undefined, err.message);
  }

  const count = found.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await FeatureOfInterest.countDocuments(findWhere);
    }
  } else {
    total = count;
  }

  const forApp = found.map(featureOfInterestDbToApp);

  return {
    data: forApp,
    count,
    total
  };

}


export async function updateFeatureOfInterest(id: string, updates: any): Promise<FeatureOfInterestApp> {

  // If there's any properties such as belongsToDeployment or createdBy that you want to remove completely, then pass in a value of null to have the property unset, e.g. {belongsToDeployment: null}.
  const modifiedUpdates = replaceNullUpdatesWithUnset(updates);

  let updated;
  try {
    updated = await FeatureOfInterest.findOneAndUpdate(
      {
        _id: id,
        deletedAt: {$exists: false}
      },
      modifiedUpdates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new UpdateFeatureOfInterestFail(undefined, err.message);
  }

  if (!updated) {
    throw new FeatureOfInterestNotFound(`A featureOfInterest with id '${id}' could not be found`);
  }

  return featureOfInterestDbToApp(updated);

}


// A soft delete
export async function deleteFeatureOfInterest(id: string): Promise<void> {

  const updates = {
    deletedAt: new Date()
  };

  let deleted;
  try {
    deleted = await FeatureOfInterest.findOneAndUpdate(
      {
        _id: id,
        deletedAt: {$exists: false}
      },
      updates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new DeleteFeatureOfInterestFail(`Failed to delete featureOfInterest '${id}'.`, err.message);
  }

  if (!deleted) {
    throw new FeatureOfInterestNotFound(`A featureOfInterest with id '${id}' could not be found`);
  }

  return;

}



function featureOfInterestAppToDb(appFormat: FeatureOfInterestApp): object {
  const dbFormat: any = cloneDeep(appFormat);
  renameProperty(dbFormat, 'id', '_id');
  return dbFormat;
}


function featureOfInterestDbToApp(dbFormat: any): FeatureOfInterestApp {
  const appFormat = dbFormat.toObject();
  appFormat.id = appFormat._id.toString();
  delete appFormat._id;
  delete appFormat.__v;
  return appFormat;
}


export function featureOfInterestAppToClient(appFormat: FeatureOfInterestApp): FeatureOfInterestClient {
  const clientFormat: any = cloneDeep(appFormat);
  if (clientFormat.location && clientFormat.location.validAt) {
    clientFormat.location.validAt = clientFormat.location.validAt.toISOString();
  }
  clientFormat.createdAt = clientFormat.createdAt.toISOString();
  clientFormat.updatedAt = clientFormat.updatedAt.toISOString();
  return clientFormat;
} 


export function featureOfInterestClientToApp(clientFormat: FeatureOfInterestClient): FeatureOfInterestApp {
  const appFormat: any = cloneDeep(clientFormat);
  return appFormat; 
}


export function completeFeatureOfInterestLocation(location: FeatureOfInterestLocation): FeatureOfInterestLocation {
  const completed = cloneDeep(location);
  if (!location.id) {
    // Does it really need an id? Platform locations did because observations would inherit it, the question is whether anything will inherit a feature of interest's id?
    completed.id = uuid(); 
  }
  if (!location.validAt) {
    completed.validAt = new Date();
  }
  // Find the centroid
  completed.centroid = calculateCentroidFromGeometry(location.geometry);
  return completed;
}