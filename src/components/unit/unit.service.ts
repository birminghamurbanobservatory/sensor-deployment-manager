import {cloneDeep} from 'lodash';
import {renameProperty} from '../../utils/rename';
import {UnitApp} from './unit-app.class';
import {UnitClient} from './unit-client.class';
import Unit from './unit.model';
import {UnitAlreadyExists} from './errors/UnitAlreadyExists';
import {CreateUnitFail} from './errors/CreateUnitFail';
import {InvalidUnit} from './errors/InvalidUnit';
import {GetUnitFail} from './errors/GetUnitFail';
import {UnitNotFound} from './errors/UnitNotFound';
import {CollectionOptions} from '../common/collection-options.class';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import * as check from 'check-types';
import {GetUnitsFail} from './errors/GetUnitsFail';
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {UpdateUnitFail} from './errors/UpdateUnitFail';
import {DeleteUnitFail} from './errors/DeleteUnitFail';



export async function createUnit(unit: UnitApp): Promise<UnitApp> {

  const unitDb = unitAppToDb(unit);

  let created;
  try {
    created = await Unit.create(unitDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new UnitAlreadyExists(`A unit with an id of '${unit.id}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidUnit(err.message);
    } else {
      throw new CreateUnitFail(undefined, err.message);
    }
  }

  return unitDbToApp(created);

}



export async function getUnit(id, options: {includeDeleted?: boolean} = {}): Promise<UnitApp> {

  const findWhere: any = {_id: id};
  
  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  let found;
  try {
    found = await Unit.findOne(findWhere).exec();
  } catch (err) {
    throw new GetUnitFail(undefined, err.message);
  }

  if (!found) {
    throw new UnitNotFound(`A unit with id '${id}' could not be found.`);
  }

  return unitDbToApp(found);

}



export async function getUnits(
  where: {
    id?: any; 
    listed?: boolean; 
    inCommonVocab?: boolean;
    createdBy?: string; 
    belongsToDeployment?: string; 
    search?: string;
  }, 
  options: CollectionOptions = {}
): Promise<{data: UnitApp[]; count: number; total: number}> {

  const findWhere = whereToMongoFind(where);

  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);

  let found;
  try {
    found = await Unit.find(findWhere, null, findOptions).exec();
  } catch (err) {
    throw new GetUnitsFail(undefined, err.message);
  }

  const count = found.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await Unit.countDocuments(findWhere);
    }
  } else {
    total = count;
  }

  const forApp = found.map(unitDbToApp);

  return {
    data: forApp,
    count,
    total
  };

}


export async function updateUnit(id: string, updates: any): Promise<UnitApp> {

  // If there's any properties such as belongsToDeployment or createdBy that you want to remove completely, then pass in a value of null to have the property unset, e.g. {belongsToDeployment: null}.
  const modifiedUpdates = replaceNullUpdatesWithUnset(updates);

  let updated;
  try {
    updated = await Unit.findOneAndUpdate(
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
    throw new UpdateUnitFail(undefined, err.message);
  }

  if (!updated) {
    throw new UnitNotFound(`A unit with id '${id}' could not be found`);
  }

  return unitDbToApp(updated);

}


// A soft delete
export async function deleteUnit(id: string): Promise<void> {

  const updates = {
    deletedAt: new Date()
  };

  let deleted;
  try {
    deleted = await Unit.findOneAndUpdate(
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
    throw new DeleteUnitFail(`Failed to delete unit '${id}'.`, err.message);
  }

  if (!deleted) {
    throw new UnitNotFound(`A unit with id '${id}' could not be found`);
  }

  return;

}



function unitAppToDb(appFormat: UnitApp): object {
  const dbFormat: any = cloneDeep(appFormat);
  renameProperty(dbFormat, 'id', '_id');
  return dbFormat;
}


function unitDbToApp(dbFormat: any): UnitApp {
  const appFormat = dbFormat.toObject();
  appFormat.id = appFormat._id.toString();
  delete appFormat._id;
  delete appFormat.__v;
  return appFormat;
}


export function unitAppToClient(appFormat: UnitApp): UnitClient {
  const clientFormat: any = cloneDeep(appFormat);
  clientFormat.createdAt = clientFormat.createdAt.toISOString();
  clientFormat.updatedAt = clientFormat.updatedAt.toISOString();
  return clientFormat;
} 


export function unitClientToApp(clientFormat: UnitClient): UnitApp {
  const appFormat: any = cloneDeep(clientFormat);
  return appFormat; 
}