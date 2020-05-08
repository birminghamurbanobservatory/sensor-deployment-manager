import * as logger from 'node-logger';
import * as joi from '@hapi/joi';
import * as check from 'check-types';
import {BadRequest} from '../../errors/BadRequest';
import {isEqual, cloneDeep} from 'lodash';
import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from '../../utils/id-generator';
import {CollectionOptions} from '../common/collection-options.class';
import {UsedProcedureClient} from './used-procedure-client.class';
import {InvalidUsedProcedure} from './errors/InvalidUsedProcedure';
import {getDeployment} from '../deployment/deployment.service';
import * as usedProcedureService from './used-procedure.service';


//-------------------------------------------------
// Create Used Procedure
//-------------------------------------------------
const newUsedProcedureSchema = joi.object({
  id: joi.string(),
  label: joi.string(),
  comment: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string()
})
.or('id', 'label')
.required();

export async function createUsedProcedure(usedProcedure: UsedProcedureClient): Promise<UsedProcedureClient> {

  logger.debug('Creating new used procedure');

  const {error: err} = newUsedProcedureSchema.validate(usedProcedure);
  if (err) {
    throw new InvalidUsedProcedure(err.message);
  }

  // If an id is given, then check it won't clash with any auto-generated IDs. 
  if (usedProcedure.id && hasIdBeenGenerated(usedProcedure.id)) {
    throw new InvalidUsedProcedure(`Used procedure ID cannot end '${suffixForGeneratedIds}'`);
  }

  // If it doesn't have an id then assign one
  if (!usedProcedure.id) {
    usedProcedure.id = generateId(usedProcedure.label);
  } 

  // If it does not have a label yet then simply use the id.
  if (!usedProcedure.label) {
    usedProcedure.label = usedProcedure.id;
  }

  // Check the deployment exists if provided
  if (usedProcedure.belongsToDeployment) {
    await getDeployment(usedProcedure.belongsToDeployment);
  }

  const created = await usedProcedureService.createUsedProcedure(usedProcedure);

  return usedProcedureService.usedProcedureAppToClient(created);

}


//-------------------------------------------------
// Get Used Procedure
//-------------------------------------------------
const getUsedProcedureOptions = joi.object({
  includeDeleted: joi.boolean()
});

export async function getUsedProcedure(id: string, options = {}): Promise<UsedProcedureClient> {

  const {error: err, value: validOptions} = getUsedProcedureOptions.validate(options);
  if (err) throw new BadRequest(`Invalid 'options' object: ${err.message}`);

  const usedProcedure = await usedProcedureService.getUsedProcedure(id, validOptions);
  logger.debug('Used procedure found', usedProcedure);
  return usedProcedureService.usedProcedureAppToClient(usedProcedure);

}


//-------------------------------------------------
// Get Used Procedures
//-------------------------------------------------
const getUsedProceduresWhereSchema = joi.object({
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
  search: joi.string()
});

const getUsedProceduresOptionsSchema = joi.object({
  limit: joi.number().integer().positive(),
  offset: joi.number().integer().min(0),
  sortBy: joi.string().valid('id'),
  sortOrder: joi.string().valid('asc', 'desc'),
  includeDeleted: joi.boolean(),
}).required();

export async function getUsedProcedures(where: any, options?: CollectionOptions): Promise<{data: UsedProcedureClient[]; meta: any}> {

  const {error: whereErr, value: validWhere} = getUsedProceduresWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid where object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getUsedProceduresOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid options object: ${optionsErr.message}`);

  const {data: usedProcedures, count, total} = await usedProcedureService.getUsedProcedures(validWhere, validOptions);
  logger.debug(`${usedProcedures.length} used procedures found`);

  const usedProceduresForClient = usedProcedures.map(usedProcedureService.usedProcedureAppToClient);
  
  return {
    data: usedProceduresForClient,
    meta: {
      count,
      total
    }
  };

}


//-------------------------------------------------
// Update Used Procedure
//-------------------------------------------------
const usedProcedureUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  label: joi.string(),
  comment: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string().allow(null)
})
.min(1)
.required(); 

export async function updateUsedProcedure(id: string, updates: any): Promise<UsedProcedureClient> {

  logger.debug(`Updating used procedure '${id}'`);

  const {error: validationErr, value: validUpdates} = usedProcedureUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Check the deployment exists if provided
  if (updates.belongsToDeployment) {
    await getDeployment(updates.belongsToDeployment);
  }

  const updatedUsedProcedure = await usedProcedureService.updateUsedProcedure(id, validUpdates);
  logger.debug(`Used procedure '${id}' updated.`);

  return usedProcedureService.usedProcedureAppToClient(updatedUsedProcedure);

}



//-------------------------------------------------
// Delete Used Procedure
//-------------------------------------------------
export async function deleteUsedProcedure(id: string): Promise<void> {
  await usedProcedureService.deleteUsedProcedure(id);
  logger.debug(`Used procedure with id: '${id}' has been deleted.`);
  return;
}

