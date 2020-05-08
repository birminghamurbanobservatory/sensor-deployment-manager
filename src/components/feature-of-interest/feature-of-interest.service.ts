import {cloneDeep} from 'lodash';
import {renameProperty} from '../../utils/rename';
import {FeatureOfInterestApp} from './feature-of-interest-app.class';
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



export async function createFeatureOfInterest(featureOfIinterest: FeatureOfInterestApp): Promise<FeatureOfInterestApp> {

  const featureOfIinterestDb = featureOfIinterestAppToDb(featureOfIinterest);

  let created;
  try {
    created = await FeatureOfInterest.create(featureOfIinterestDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new FeatureOfInterestAlreadyExists(`A featureOfIinterest with an id of '${featureOfIinterest.id}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidFeatureOfInterest(err.message);
    } else {
      throw new CreateFeatureOfInterestFail(undefined, err.message);
    }
  }

  return featureOfIinterestDbToApp(created);

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
    throw new FeatureOfInterestNotFound(`A featureOfIinterest with id '${id}' could not be found.`);
  }

  return featureOfIinterestDbToApp(found);

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

  const forApp = found.map(featureOfIinterestDbToApp);

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
    throw new FeatureOfInterestNotFound(`A featureOfIinterest with id '${id}' could not be found`);
  }

  return featureOfIinterestDbToApp(updated);

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
    throw new DeleteFeatureOfInterestFail(`Failed to delete featureOfIinterest '${id}'.`, err.message);
  }

  if (!deleted) {
    throw new FeatureOfInterestNotFound(`A featureOfIinterest with id '${id}' could not be found`);
  }

  return;

}



function featureOfIinterestAppToDb(appFormat: FeatureOfInterestApp): object {
  const dbFormat: any = cloneDeep(appFormat);
  renameProperty(dbFormat, 'id', '_id');
  return dbFormat;
}


function featureOfIinterestDbToApp(dbFormat: any): FeatureOfInterestApp {
  const appFormat = dbFormat.toObject();
  appFormat.id = appFormat._id.toString();
  delete appFormat._id;
  delete appFormat.__v;
  return appFormat;
}


export function featureOfIinterestAppToClient(appFormat: FeatureOfInterestApp): FeatureOfInterestClient {
  const clientFormat: any = cloneDeep(appFormat);
  clientFormat.createdAt = clientFormat.createdAt.toISOString();
  clientFormat.updatedAt = clientFormat.updatedAt.toISOString();
  return clientFormat;
} 


export function featureOfIinterestClientToApp(clientFormat: FeatureOfInterestClient): FeatureOfInterestApp {
  const appFormat: any = cloneDeep(clientFormat);
  return appFormat; 
}