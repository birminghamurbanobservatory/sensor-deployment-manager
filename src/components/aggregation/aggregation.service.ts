import {cloneDeep} from 'lodash';
import {renameProperty} from '../../utils/rename';
import {AggregationApp} from './aggregation-app.class';
import {AggregationClient} from './aggregation-client.class';
import Aggregation from './aggregation.model';
import {AggregationAlreadyExists} from './errors/AggregationAlreadyExists';
import {CreateAggregationFail} from './errors/CreateAggregationFail';
import {InvalidAggregation} from './errors/InvalidAggregation';
import {GetAggregationFail} from './errors/GetAggregationFail';
import {AggregationNotFound} from './errors/AggregationNotFound';
import {CollectionOptions} from '../common/collection-options.interface';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import * as check from 'check-types';
import {GetAggregationsFail} from './errors/GetAggregationsFail';
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {UpdateAggregationFail} from './errors/UpdateAggregationFail';
import {DeleteAggregationFail} from './errors/DeleteAggregationFail';
import {GetResourceOptions} from '../common/get-resource-options.interface';
import {AggregationIsDeleted} from './errors/AggregationIsDeleted';
import {formatDistanceToNow} from 'date-fns';



export async function createAggregation(aggregation: AggregationApp): Promise<AggregationApp> {

  const aggregationDb = aggregationAppToDb(aggregation);

  let created;
  try {
    created = await Aggregation.create(aggregationDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new AggregationAlreadyExists(`A aggregation with an id of '${aggregation.id}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidAggregation(err.message);
    } else {
      throw new CreateAggregationFail(undefined, err.message);
    }
  }

  return aggregationDbToApp(created);

}



export async function getAggregation(id, options: GetResourceOptions = {}): Promise<AggregationApp> {

  const findWhere: any = {_id: id};
  
  let found;
  try {
    found = await Aggregation.findOne(findWhere).exec();
  } catch (err) {
    throw new GetAggregationFail(undefined, err.message);
  }

  if (!found) {
    throw new AggregationNotFound(`A aggregation with id '${id}' could not be found.`);
  }

  if (!options.includeDeleted && found.deletedAt) {
    throw new AggregationIsDeleted(`The aggregation with '${id}' was deleted ${formatDistanceToNow(found.deletedAt)} ago.`);
  }

  return aggregationDbToApp(found);

}



export async function getAggregations(
  where: {
    id?: any; 
    listed?: boolean; 
    inCommonVocab?: boolean;
    createdBy?: string; 
    belongsToDeployment?: string; 
    search?: string;
  }, 
  options: CollectionOptions = {}
): Promise<{data: AggregationApp[]; count: number; total: number}> {

  const findWhere = whereToMongoFind(where);

  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);

  let found;
  try {
    found = await Aggregation.find(findWhere, null, findOptions).exec();
  } catch (err) {
    throw new GetAggregationsFail(undefined, err.message);
  }

  const count = found.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await Aggregation.countDocuments(findWhere);
    }
  } else {
    total = count;
  }

  const forApp = found.map(aggregationDbToApp);

  return {
    data: forApp,
    count,
    total
  };

}


export async function updateAggregation(id: string, updates: any): Promise<AggregationApp> {

  // If there's any properties such as belongsToDeployment or createdBy that you want to remove completely, then pass in a value of null to have the property unset, e.g. {belongsToDeployment: null}.
  const modifiedUpdates = replaceNullUpdatesWithUnset(updates);

  let updated;
  try {
    updated = await Aggregation.findOneAndUpdate(
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
    throw new UpdateAggregationFail(undefined, err.message);
  }

  if (!updated) {
    throw new AggregationNotFound(`A aggregation with id '${id}' could not be found`);
  }

  return aggregationDbToApp(updated);

}


// A soft delete
export async function deleteAggregation(id: string): Promise<void> {

  const updates = {
    deletedAt: new Date()
  };

  let deleted;
  try {
    deleted = await Aggregation.findOneAndUpdate(
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
    throw new DeleteAggregationFail(`Failed to delete aggregation '${id}'.`, err.message);
  }

  if (!deleted) {
    throw new AggregationNotFound(`A aggregation with id '${id}' could not be found`);
  }

  return;

}



function aggregationAppToDb(appFormat: AggregationApp): object {
  const dbFormat: any = cloneDeep(appFormat);
  renameProperty(dbFormat, 'id', '_id');
  return dbFormat;
}


function aggregationDbToApp(dbFormat: any): AggregationApp {
  const appFormat = dbFormat.toObject();
  appFormat.id = appFormat._id.toString();
  delete appFormat._id;
  delete appFormat.__v;
  return appFormat;
}


export function aggregationAppToClient(appFormat: AggregationApp): AggregationClient {
  const clientFormat: any = cloneDeep(appFormat);
  clientFormat.createdAt = clientFormat.createdAt.toISOString();
  clientFormat.updatedAt = clientFormat.updatedAt.toISOString();
  return clientFormat;
} 


export function aggregationClientToApp(clientFormat: AggregationClient): AggregationApp {
  const appFormat: any = cloneDeep(clientFormat);
  return appFormat; 
}