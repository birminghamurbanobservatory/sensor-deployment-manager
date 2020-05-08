import * as logger from 'node-logger';
import * as joi from '@hapi/joi';
import * as check from 'check-types';
import {BadRequest} from '../../errors/BadRequest';
import {isEqual, cloneDeep} from 'lodash';
import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from '../../utils/id-generator';
import {CollectionOptions} from '../common/collection-options.class';
import {ProcedureClient} from './procedure-client.class';
import {InvalidProcedure} from './errors/InvalidProcedure';
import {getDeployment} from '../deployment/deployment.service';
import * as procedureService from './procedure.service';


//-------------------------------------------------
// Create Procedure
//-------------------------------------------------
const newProcedureSchema = joi.object({
  id: joi.string(),
  label: joi.string(),
  comment: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string(),
  createdBy: joi.string()
})
.or('id', 'label')
.required();

export async function createProcedure(procedure: ProcedureClient): Promise<ProcedureClient> {

  logger.debug('Creating new procedure');

  const {error: err} = newProcedureSchema.validate(procedure);
  if (err) {
    throw new InvalidProcedure(err.message);
  }

  // If an id is given, then check it won't clash with any auto-generated IDs. 
  if (procedure.id && hasIdBeenGenerated(procedure.id)) {
    throw new InvalidProcedure(`Procedure ID cannot end '${suffixForGeneratedIds}'`);
  }

  // If it doesn't have an id then assign one
  if (!procedure.id) {
    procedure.id = generateId(procedure.label);
  } 

  // If it does not have a label yet then simply use the id.
  if (!procedure.label) {
    procedure.label = procedure.id;
  }

  // Check the deployment exists if provided
  if (procedure.belongsToDeployment) {
    await getDeployment(procedure.belongsToDeployment);
  }

  const created = await procedureService.createProcedure(procedure);

  return procedureService.procedureAppToClient(created);

}


//-------------------------------------------------
// Get Procedure
//-------------------------------------------------
const getProcedureOptions = joi.object({
  includeDeleted: joi.boolean()
});

export async function getProcedure(id: string, options = {}): Promise<ProcedureClient> {

  const {error: err, value: validOptions} = getProcedureOptions.validate(options);
  if (err) throw new BadRequest(`Invalid 'options' object: ${err.message}`);

  const procedure = await procedureService.getProcedure(id, validOptions);
  logger.debug('Procedure found', procedure);
  return procedureService.procedureAppToClient(procedure);

}


//-------------------------------------------------
// Get Procedures
//-------------------------------------------------
const getProceduresWhereSchema = joi.object({
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

const getProceduresOptionsSchema = joi.object({
  limit: joi.number().integer().positive(),
  offset: joi.number().integer().min(0),
  sortBy: joi.string().valid('id'),
  sortOrder: joi.string().valid('asc', 'desc'),
  includeDeleted: joi.boolean(),
}).required();

export async function getProcedures(where: any, options?: CollectionOptions): Promise<{data: ProcedureClient[]; meta: any}> {

  const {error: whereErr, value: validWhere} = getProceduresWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid where object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getProceduresOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid options object: ${optionsErr.message}`);

  const {data: procedures, count, total} = await procedureService.getProcedures(validWhere, validOptions);
  logger.debug(`${procedures.length} procedures found`);

  const proceduresForClient = procedures.map(procedureService.procedureAppToClient);
  
  return {
    data: proceduresForClient,
    meta: {
      count,
      total
    }
  };

}


//-------------------------------------------------
// Update Procedure
//-------------------------------------------------
const procedureUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  label: joi.string(),
  comment: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string().allow(null)
})
.min(1)
.required(); 

export async function updateProcedure(id: string, updates: any): Promise<ProcedureClient> {

  logger.debug(`Updating used procedure '${id}'`);

  const {error: validationErr, value: validUpdates} = procedureUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Check the deployment exists if provided
  if (updates.belongsToDeployment) {
    await getDeployment(updates.belongsToDeployment);
  }

  const updatedProcedure = await procedureService.updateProcedure(id, validUpdates);
  logger.debug(`Procedure '${id}' updated.`);

  return procedureService.procedureAppToClient(updatedProcedure);

}



//-------------------------------------------------
// Delete Procedure
//-------------------------------------------------
export async function deleteProcedure(id: string): Promise<void> {
  await procedureService.deleteProcedure(id);
  logger.debug(`Procedure with id: '${id}' has been deleted.`);
  return;
}

