import * as logger from 'node-logger';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from '../../utils/id-generator';
import {CollectionOptions} from '../common/collection-options.interface';
import {DisciplineClient} from './discipline-client.class';
import {InvalidDiscipline} from './errors/InvalidDiscipline';
import {getDeployment} from '../deployment/deployment.service';
import * as disciplineService from './discipline.service';


//-------------------------------------------------
// Create Discipline
//-------------------------------------------------
const newDisciplineSchema = joi.object({
  id: joi.string(),
  label: joi.string(),
  description: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string(),
  createdBy: joi.string()
})
.or('id', 'label')
.required();

export async function createDiscipline(discipline: DisciplineClient): Promise<DisciplineClient> {

  logger.debug('Creating new discipline');

  const {error: err} = newDisciplineSchema.validate(discipline);
  if (err) {
    throw new InvalidDiscipline(err.message);
  }

  // If an id is given, then check it won't clash with any auto-generated IDs. 
  if (discipline.id && hasIdBeenGenerated(discipline.id)) {
    throw new InvalidDiscipline(`Discipline ID cannot end '${suffixForGeneratedIds}'`);
  }

  // If it doesn't have an id then assign one
  if (!discipline.id) {
    discipline.id = generateId(discipline.label);
  } 

  // If it does not have a label yet then simply use the id.
  if (!discipline.label) {
    discipline.label = discipline.id;
  }

  // Check the deployment exists if provided
  if (discipline.belongsToDeployment) {
    await getDeployment(discipline.belongsToDeployment);
  }

  const created = await disciplineService.createDiscipline(discipline);

  return disciplineService.disciplineAppToClient(created);

}


//-------------------------------------------------
// Get Discipline
//-------------------------------------------------
const getDisciplineOptions = joi.object({
  includeDeleted: joi.boolean()
});

export async function getDiscipline(id: string, options = {}): Promise<DisciplineClient> {

  const {error: err, value: validOptions} = getDisciplineOptions.validate(options);
  if (err) throw new BadRequest(`Invalid 'options' object: ${err.message}`);

  const discipline = await disciplineService.getDiscipline(id, validOptions);
  logger.debug('Discipline found', discipline);
  return disciplineService.disciplineAppToClient(discipline);

}


//-------------------------------------------------
// Get Disciplines
//-------------------------------------------------
const getDisciplinesWhereSchema = joi.object({
  id: joi.object({
    begins: joi.string(),
    in: joi.array().items(joi.string()).min(1)
  }),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  createdBy: joi.alternatives().try(
    joi.string(),
    joi.object({
      exists: joi.boolean()
    }).min(1)
  ),
  belongsToDeployment: joi.alternatives().try(
    joi.string(),
    joi.object({
      in: joi.array().items(joi.string()).min(1),
      exists: joi.boolean()
    }).min(1)
  ),
  or: joi.array().min(1), // TODO add a schema for items in this array.
  search: joi.string()
});

const getDisciplinesOptionsSchema = joi.object({
  limit: joi.number().integer().positive(),
  offset: joi.number().integer().min(0),
  sortBy: joi.string().valid('id'),
  sortOrder: joi.string().valid('asc', 'desc'),
  includeDeleted: joi.boolean(),
}).required();

export async function getDisciplines(where: any, options?: CollectionOptions): Promise<{data: DisciplineClient[]; meta: any}> {

  const {error: whereErr, value: validWhere} = getDisciplinesWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid where object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getDisciplinesOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid options object: ${optionsErr.message}`);

  const {data: disciplines, count, total} = await disciplineService.getDisciplines(validWhere, validOptions);
  logger.debug(`${disciplines.length} disciplines found`);

  const disciplinesForClient = disciplines.map(disciplineService.disciplineAppToClient);
  
  return {
    data: disciplinesForClient,
    meta: {
      count,
      total
    }
  };

}


//-------------------------------------------------
// Update Discipline
//-------------------------------------------------
const disciplineUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  label: joi.string(),
  description: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string().allow(null)
})
.min(1)
.required(); 

export async function updateDiscipline(id: string, updates: any): Promise<DisciplineClient> {

  logger.debug(`Updating used discipline '${id}'`);

  const {error: validationErr, value: validUpdates} = disciplineUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Check the deployment exists if provided
  if (updates.belongsToDeployment) {
    await getDeployment(updates.belongsToDeployment);
  }

  const updatedDiscipline = await disciplineService.updateDiscipline(id, validUpdates);
  logger.debug(`Discipline '${id}' updated.`);

  return disciplineService.disciplineAppToClient(updatedDiscipline);

}



//-------------------------------------------------
// Delete Discipline
//-------------------------------------------------
export async function deleteDiscipline(id: string): Promise<void> {
  await disciplineService.deleteDiscipline(id);
  logger.debug(`Discipline with id: '${id}' has been deleted.`);
  return;
}

