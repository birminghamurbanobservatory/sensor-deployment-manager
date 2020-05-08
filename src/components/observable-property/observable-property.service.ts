import {cloneDeep} from 'lodash';
import {renameProperty} from '../../utils/rename';
import {ObservablePropertyApp} from './observable-property-app.class';
import {ObservablePropertyClient} from './observable-property-client.class';
import ObservableProperty from './observable-property.model';
import {ObservablePropertyAlreadyExists} from './errors/ObservablePropertyAlreadyExists';
import {CreateObservablePropertyFail} from './errors/CreateObservablePropertyFail';
import {InvalidObservableProperty} from './errors/InvalidObservableProperty';
import {GetObservablePropertyFail} from './errors/GetObservablePropertyFail';
import {ObservablePropertyNotFound} from './errors/ObservablePropertyNotFound';
import {CollectionOptions} from '../common/collection-options.class';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import * as check from 'check-types';
import {GetObservablePropertiesFail} from './errors/GetObservablePropertiesFail';
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {UpdateObservablePropertyFail} from './errors/UpdateObservablePropertyFail';
import {DeleteObservablePropertyFail} from './errors/DeleteObservablePropertyFail';



export async function createObservableProperty(observableProperty: ObservablePropertyApp): Promise<ObservablePropertyApp> {

  const observablePropertyDb = observablePropertyAppToDb(observableProperty);

  let created;
  try {
    created = await ObservableProperty.create(observablePropertyDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new ObservablePropertyAlreadyExists(`A observableProperty with an id of '${observableProperty.id}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidObservableProperty(err.message);
    } else {
      throw new CreateObservablePropertyFail(undefined, err.message);
    }
  }

  return observablePropertyDbToApp(created);

}



export async function getObservableProperty(id, options: {includeDeleted?: boolean} = {}): Promise<ObservablePropertyApp> {

  const findWhere: any = {_id: id};
  
  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  let found;
  try {
    found = await ObservableProperty.findOne(findWhere).exec();
  } catch (err) {
    throw new GetObservablePropertyFail(undefined, err.message);
  }

  if (!found) {
    throw new ObservablePropertyNotFound(`A observableProperty with id '${id}' could not be found.`);
  }

  return observablePropertyDbToApp(found);

}



export async function getObservableProperties(
  where: {
    id?: any; 
    listed?: boolean; 
    inCommonVocab?: boolean;
    createdBy?: string; 
    belongsToDeployment?: string; 
    search?: string;
  }, 
  options: CollectionOptions = {}
): Promise<{data: ObservablePropertyApp[]; count: number; total: number}> {

  const findWhere = whereToMongoFind(where);

  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);

  let found;
  try {
    found = await ObservableProperty.find(findWhere, null, findOptions).exec();
  } catch (err) {
    throw new GetObservablePropertiesFail(undefined, err.message);
  }

  const count = found.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await ObservableProperty.countDocuments(findWhere);
    }
  } else {
    total = count;
  }

  const forApp = found.map(observablePropertyDbToApp);

  return {
    data: forApp,
    count,
    total
  };

}


export async function updateObservableProperty(id: string, updates: any): Promise<ObservablePropertyApp> {

  // If there's any properties such as belongsToDeployment or createdBy that you want to remove completely, then pass in a value of null to have the property unset, e.g. {belongsToDeployment: null}.
  const modifiedUpdates = replaceNullUpdatesWithUnset(updates);

  let updated;
  try {
    updated = await ObservableProperty.findOneAndUpdate(
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
    throw new UpdateObservablePropertyFail(undefined, err.message);
  }

  if (!updated) {
    throw new ObservablePropertyNotFound(`A observableProperty with id '${id}' could not be found`);
  }

  return observablePropertyDbToApp(updated);

}


// A soft delete
export async function deleteObservableProperty(id: string): Promise<void> {

  const updates = {
    deletedAt: new Date()
  };

  let deleted;
  try {
    deleted = await ObservableProperty.findOneAndUpdate(
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
    throw new DeleteObservablePropertyFail(`Failed to delete observableProperty '${id}'.`, err.message);
  }

  if (!deleted) {
    throw new ObservablePropertyNotFound(`A observableProperty with id '${id}' could not be found`);
  }

  return;

}



function observablePropertyAppToDb(appFormat: ObservablePropertyApp): object {
  const dbFormat: any = cloneDeep(appFormat);
  renameProperty(dbFormat, 'id', '_id');
  return dbFormat;
}


function observablePropertyDbToApp(dbFormat: any): ObservablePropertyApp {
  const appFormat = dbFormat.toObject();
  appFormat.id = appFormat._id.toString();
  delete appFormat._id;
  delete appFormat.__v;
  return appFormat;
}


export function observablePropertyAppToClient(appFormat: ObservablePropertyApp): ObservablePropertyClient {
  const clientFormat: any = cloneDeep(appFormat);
  clientFormat.createdAt = clientFormat.createdAt.toISOString();
  clientFormat.updatedAt = clientFormat.updatedAt.toISOString();
  return clientFormat;
} 


export function observablePropertyClientToApp(clientFormat: ObservablePropertyClient): ObservablePropertyApp {
  const appFormat: any = cloneDeep(clientFormat);
  return appFormat; 
}