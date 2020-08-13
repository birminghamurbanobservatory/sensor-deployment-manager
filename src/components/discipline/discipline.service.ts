import {cloneDeep} from 'lodash';
import {renameProperty} from '../../utils/rename';
import {DisciplineApp} from './discipline-app.class';
import {DisciplineClient} from './discipline-client.class';
import Discipline from './discipline.model';
import {DisciplineAlreadyExists} from './errors/DisciplineAlreadyExists';
import {CreateDisciplineFail} from './errors/CreateDisciplineFail';
import {InvalidDiscipline} from './errors/InvalidDiscipline';
import {GetDisciplineFail} from './errors/GetDisciplineFail';
import {DisciplineNotFound} from './errors/DisciplineNotFound';
import {CollectionOptions} from '../common/collection-options.interface';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import * as check from 'check-types';
import {GetDisciplinesFail} from './errors/GetDisciplinesFail';
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {UpdateDisciplineFail} from './errors/UpdateDisciplineFail';
import {DeleteDisciplineFail} from './errors/DeleteDisciplineFail';
import {GetResourceOptions} from '../common/get-resource-options.interface';
import {formatDistanceToNow} from 'date-fns';
import {DisciplineIsDeleted} from './errors/DisciplineIsDeleted';



export async function createDiscipline(discipline: DisciplineApp): Promise<DisciplineApp> {

  const disciplineDb = disciplineAppToDb(discipline);

  let created;
  try {
    created = await Discipline.create(disciplineDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new DisciplineAlreadyExists(`A discipline with an id of '${discipline.id}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidDiscipline(err.message);
    } else {
      throw new CreateDisciplineFail(undefined, err.message);
    }
  }

  return disciplineDbToApp(created);

}



export async function getDiscipline(id, options: GetResourceOptions = {}): Promise<DisciplineApp> {

  const findWhere: any = {_id: id};
  
  let found;
  try {
    found = await Discipline.findOne(findWhere).exec();
  } catch (err) {
    throw new GetDisciplineFail(undefined, err.message);
  }

  if (!found) {
    throw new DisciplineNotFound(`A discipline with id '${id}' could not be found.`);
  }

  if (!options.includeDeleted && found.deletedAt) {
    throw new DisciplineIsDeleted(`The discipline with '${id}' was deleted ${formatDistanceToNow(found.deletedAt)} ago.`);
  }

  return disciplineDbToApp(found);

}



export async function getDisciplines(
  where: {
    id?: any; 
    listed?: boolean; 
    inCommonVocab?: boolean;
    createdBy?: string; 
    belongsToDeployment?: string; 
    search?: string;
  }, 
  options: CollectionOptions = {}
): Promise<{data: DisciplineApp[]; count: number; total: number}> {

  const findWhere = whereToMongoFind(where);

  if (!options.includeDeleted) {
    findWhere.deletedAt = {$exists: false};
  }

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);

  let found;
  try {
    found = await Discipline.find(findWhere, null, findOptions).exec();
  } catch (err) {
    throw new GetDisciplinesFail(undefined, err.message);
  }

  const count = found.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await Discipline.countDocuments(findWhere);
    }
  } else {
    total = count;
  }

  const forApp = found.map(disciplineDbToApp);

  return {
    data: forApp,
    count,
    total
  };

}


export async function updateDiscipline(id: string, updates: any): Promise<DisciplineApp> {

  // If there's any properties such as belongsToDeployment or createdBy that you want to remove completely, then pass in a value of null to have the property unset, e.g. {belongsToDeployment: null}.
  const modifiedUpdates = replaceNullUpdatesWithUnset(updates);

  let updated;
  try {
    updated = await Discipline.findOneAndUpdate(
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
    throw new UpdateDisciplineFail(undefined, err.message);
  }

  if (!updated) {
    throw new DisciplineNotFound(`A discipline with id '${id}' could not be found`);
  }

  return disciplineDbToApp(updated);

}


// A soft delete
export async function deleteDiscipline(id: string): Promise<void> {

  const updates = {
    deletedAt: new Date()
  };

  let deleted;
  try {
    deleted = await Discipline.findOneAndUpdate(
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
    throw new DeleteDisciplineFail(`Failed to delete discipline '${id}'.`, err.message);
  }

  if (!deleted) {
    throw new DisciplineNotFound(`A discipline with id '${id}' could not be found`);
  }

  return;

}



function disciplineAppToDb(appFormat: DisciplineApp): object {
  const dbFormat: any = cloneDeep(appFormat);
  renameProperty(dbFormat, 'id', '_id');
  return dbFormat;
}


function disciplineDbToApp(dbFormat: any): DisciplineApp {
  const appFormat = dbFormat.toObject();
  appFormat.id = appFormat._id.toString();
  delete appFormat._id;
  delete appFormat.__v;
  return appFormat;
}


export function disciplineAppToClient(appFormat: DisciplineApp): DisciplineClient {
  const clientFormat: any = cloneDeep(appFormat);
  clientFormat.createdAt = clientFormat.createdAt.toISOString();
  clientFormat.updatedAt = clientFormat.updatedAt.toISOString();
  return clientFormat;
} 


export function disciplineClientToApp(clientFormat: DisciplineClient): DisciplineApp {
  const appFormat: any = cloneDeep(clientFormat);
  return appFormat; 
}