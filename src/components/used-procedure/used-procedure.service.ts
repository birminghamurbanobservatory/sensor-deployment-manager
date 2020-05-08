import {cloneDeep} from 'lodash';
import {renameProperty} from '../../utils/rename';
import {UsedProcedureApp} from './used-procedure-app.class';
import {UsedProcedureClient} from './used-procedure-client.class';
import UsedProcedure from './used-procedure.model';
import {UsedProcedureAlreadyExists} from './errors/UsedProcedureAlreadyExists';
import {CreateUsedProcedureFail} from './errors/CreateUsedProcedureFail';
import {InvalidUsedProcedure} from './errors/InvalidUsedProcedure';
import {GetUsedProcedureFail} from './errors/GetUsedProcedureFail';
import {UsedProcedureNotFound} from './errors/UsedProcedureNotFound';
import {CollectionOptions} from '../common/collection-options.class';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import * as check from 'check-types';
import {GetUsedProceduresFail} from './errors/GetUsedProceduresFail';
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {UpdateUsedProcedureFail} from './errors/UpdateUsedProcedureFail';
import {DeleteUsedProcedureFail} from './errors/DeleteUsedProcedureFail';



export async function createUsedProcedure(usedProcedure: UsedProcedureApp): Promise<UsedProcedureApp> {

  const usedProcedureDb = usedProcedureAppToDb(usedProcedure);

  let created;
  try {
    created = await UsedProcedure.create(usedProcedureDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new UsedProcedureAlreadyExists(`A used procedure with an id of '${usedProcedure.id}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidUsedProcedure(err.message);
    } else {
      throw new CreateUsedProcedureFail(undefined, err.message);
    }
  }

  return usedProcedureDbToApp(created);

}



export async function getUsedProcedure(id, options: {includeDeleted?: boolean} = {}): Promise<UsedProcedureApp> {

  const findWhere: any = {_id: id};
  
  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  let found;
  try {
    found = await UsedProcedure.findOne(findWhere).exec();
  } catch (err) {
    throw new GetUsedProcedureFail(undefined, err.message);
  }

  if (!found) {
    throw new UsedProcedureNotFound(`A used procedure with id '${id}' could not be found.`);
  }

  return usedProcedureDbToApp(found);

}



export async function getUsedProcedures(
  where: {
    id?: any; 
    listed?: boolean; 
    inCommonVocab?: boolean;
    createdBy?: string; 
    belongsToDeployment?: string; 
    search?: string;
  }, 
  options: CollectionOptions = {}
): Promise<{data: UsedProcedureApp[]; count: number; total: number}> {

  const findWhere = whereToMongoFind(where);

  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);

  let found;
  try {
    found = await UsedProcedure.find(findWhere, null, findOptions).exec();
  } catch (err) {
    throw new GetUsedProceduresFail(undefined, err.message);
  }

  const count = found.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await UsedProcedure.countDocuments(findWhere);
    }
  } else {
    total = count;
  }

  const forApp = found.map(usedProcedureDbToApp);

  return {
    data: forApp,
    count,
    total
  };

}


export async function updateUsedProcedure(id: string, updates: any): Promise<UsedProcedureApp> {

  // If there's any properties such as belongsToDeployment or createdBy that you want to remove completely, then pass in a value of null to have the property unset, e.g. {belongsToDeployment: null}.
  const modifiedUpdates = replaceNullUpdatesWithUnset(updates);

  let updated;
  try {
    updated = await UsedProcedure.findOneAndUpdate(
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
    throw new UpdateUsedProcedureFail(undefined, err.message);
  }

  if (!updated) {
    throw new UsedProcedureNotFound(`A used procedure with id '${id}' could not be found`);
  }

  return usedProcedureDbToApp(updated);

}


// A soft delete
export async function deleteUsedProcedure(id: string): Promise<void> {

  const updates = {
    deletedAt: new Date()
  };

  let deleted;
  try {
    deleted = await UsedProcedure.findOneAndUpdate(
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
    throw new DeleteUsedProcedureFail(`Failed to delete used procedure '${id}'.`, err.message);
  }

  if (!deleted) {
    throw new UsedProcedureNotFound(`A used procedure with id '${id}' could not be found`);
  }

  return;

}



function usedProcedureAppToDb(appFormat: UsedProcedureApp): object {
  const dbFormat: any = cloneDeep(appFormat);
  renameProperty(dbFormat, 'id', '_id');
  return dbFormat;
}


function usedProcedureDbToApp(dbFormat: any): UsedProcedureApp {
  const appFormat = dbFormat.toObject();
  appFormat.id = appFormat._id.toString();
  delete appFormat._id;
  delete appFormat.__v;
  return appFormat;
}


export function usedProcedureAppToClient(appFormat: UsedProcedureApp): UsedProcedureClient {
  const clientFormat: any = cloneDeep(appFormat);
  clientFormat.createdAt = clientFormat.createdAt.toISOString();
  clientFormat.updatedAt = clientFormat.updatedAt.toISOString();
  return clientFormat;
} 


export function usedProcedureClientToApp(clientFormat: UsedProcedureClient): UsedProcedureApp {
  const appFormat: any = cloneDeep(clientFormat);
  return appFormat; 
}