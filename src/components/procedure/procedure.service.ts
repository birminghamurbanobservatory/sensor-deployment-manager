import {cloneDeep} from 'lodash';
import {renameProperty} from '../../utils/rename';
import {ProcedureApp} from './procedure-app.class';
import {ProcedureClient} from './procedure-client.class';
import Procedure from './procedure.model';
import {ProcedureAlreadyExists} from './errors/ProcedureAlreadyExists';
import {CreateProcedureFail} from './errors/CreateProcedureFail';
import {InvalidProcedure} from './errors/InvalidProcedure';
import {GetProcedureFail} from './errors/GetProcedureFail';
import {ProcedureNotFound} from './errors/ProcedureNotFound';
import {CollectionOptions} from '../common/collection-options.class';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import * as check from 'check-types';
import {GetProceduresFail} from './errors/GetProceduresFail';
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {UpdateProcedureFail} from './errors/UpdateProcedureFail';
import {DeleteProcedureFail} from './errors/DeleteProcedureFail';



export async function createProcedure(procedure: ProcedureApp): Promise<ProcedureApp> {

  const procedureDb = procedureAppToDb(procedure);

  let created;
  try {
    created = await Procedure.create(procedureDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new ProcedureAlreadyExists(`A procedure with an id of '${procedure.id}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidProcedure(err.message);
    } else {
      throw new CreateProcedureFail(undefined, err.message);
    }
  }

  return procedureDbToApp(created);

}



export async function getProcedure(id, options: {includeDeleted?: boolean} = {}): Promise<ProcedureApp> {

  const findWhere: any = {_id: id};
  
  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  let found;
  try {
    found = await Procedure.findOne(findWhere).exec();
  } catch (err) {
    throw new GetProcedureFail(undefined, err.message);
  }

  if (!found) {
    throw new ProcedureNotFound(`A procedure with id '${id}' could not be found.`);
  }

  return procedureDbToApp(found);

}



export async function getProcedures(
  where: {
    id?: any; 
    listed?: boolean; 
    inCommonVocab?: boolean;
    createdBy?: string; 
    belongsToDeployment?: string; 
    search?: string;
  }, 
  options: CollectionOptions = {}
): Promise<{data: ProcedureApp[]; count: number; total: number}> {

  const findWhere = whereToMongoFind(where);

  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);

  let found;
  try {
    found = await Procedure.find(findWhere, null, findOptions).exec();
  } catch (err) {
    throw new GetProceduresFail(undefined, err.message);
  }

  const count = found.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await Procedure.countDocuments(findWhere);
    }
  } else {
    total = count;
  }

  const forApp = found.map(procedureDbToApp);

  return {
    data: forApp,
    count,
    total
  };

}


export async function updateProcedure(id: string, updates: any): Promise<ProcedureApp> {

  // If there's any properties such as belongsToDeployment or createdBy that you want to remove completely, then pass in a value of null to have the property unset, e.g. {belongsToDeployment: null}.
  const modifiedUpdates = replaceNullUpdatesWithUnset(updates);

  let updated;
  try {
    updated = await Procedure.findOneAndUpdate(
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
    throw new UpdateProcedureFail(undefined, err.message);
  }

  if (!updated) {
    throw new ProcedureNotFound(`A procedure with id '${id}' could not be found`);
  }

  return procedureDbToApp(updated);

}


// A soft delete
export async function deleteProcedure(id: string): Promise<void> {

  const updates = {
    deletedAt: new Date()
  };

  let deleted;
  try {
    deleted = await Procedure.findOneAndUpdate(
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
    throw new DeleteProcedureFail(`Failed to delete procedure '${id}'.`, err.message);
  }

  if (!deleted) {
    throw new ProcedureNotFound(`A procedure with id '${id}' could not be found`);
  }

  return;

}



function procedureAppToDb(appFormat: ProcedureApp): object {
  const dbFormat: any = cloneDeep(appFormat);
  renameProperty(dbFormat, 'id', '_id');
  return dbFormat;
}


function procedureDbToApp(dbFormat: any): ProcedureApp {
  const appFormat = dbFormat.toObject();
  appFormat.id = appFormat._id.toString();
  delete appFormat._id;
  delete appFormat.__v;
  return appFormat;
}


export function procedureAppToClient(appFormat: ProcedureApp): ProcedureClient {
  const clientFormat: any = cloneDeep(appFormat);
  clientFormat.createdAt = clientFormat.createdAt.toISOString();
  clientFormat.updatedAt = clientFormat.updatedAt.toISOString();
  return clientFormat;
} 


export function procedureClientToApp(clientFormat: ProcedureClient): ProcedureApp {
  const appFormat: any = cloneDeep(clientFormat);
  return appFormat; 
}