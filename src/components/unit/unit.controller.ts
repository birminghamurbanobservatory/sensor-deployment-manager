import * as logger from 'node-logger';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from '../../utils/id-generator';
import {CollectionOptions} from '../common/collection-options.interface';
import {UnitClient} from './unit-client.class';
import {InvalidUnit} from './errors/InvalidUnit';
import {getDeployment} from '../deployment/deployment.service';
import * as unitService from './unit.service';


//-------------------------------------------------
// Create Unit
//-------------------------------------------------
const newUnitSchema = joi.object({
  id: joi.string(),
  label: joi.string(),
  description: joi.string().allow(''),
  symbol: joi.string(),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string(),
  createdBy: joi.string()
})
.or('id', 'label')
.required();

export async function createUnit(unit: UnitClient): Promise<UnitClient> {

  logger.debug('Creating new unit');

  const {error: err} = newUnitSchema.validate(unit);
  if (err) {
    throw new InvalidUnit(err.message);
  }

  // If an id is given, then check it won't clash with any auto-generated IDs. 
  if (unit.id && hasIdBeenGenerated(unit.id)) {
    throw new InvalidUnit(`Unit ID cannot end '${suffixForGeneratedIds}'`);
  }

  // If it doesn't have an id then assign one
  if (!unit.id) {
    unit.id = generateId(unit.label);
  } 

  // If it does not have a label yet then simply use the id.
  if (!unit.label) {
    unit.label = unit.id;
  }

  // Check the deployment exists if provided
  if (unit.belongsToDeployment) {
    await getDeployment(unit.belongsToDeployment);
  }

  const created = await unitService.createUnit(unit);

  return unitService.unitAppToClient(created);

}


//-------------------------------------------------
// Get Unit
//-------------------------------------------------
const getUnitOptions = joi.object({
  includeDeleted: joi.boolean()
});

export async function getUnit(id: string, options = {}): Promise<UnitClient> {

  const {error: err, value: validOptions} = getUnitOptions.validate(options);
  if (err) throw new BadRequest(`Invalid 'options' object: ${err.message}`);

  const unit = await unitService.getUnit(id, validOptions);
  logger.debug('Unit found', unit);
  return unitService.unitAppToClient(unit);

}


//-------------------------------------------------
// Get Units
//-------------------------------------------------
const getUnitsWhereSchema = joi.object({
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

const getUnitsOptionsSchema = joi.object({
  limit: joi.number().integer().positive(),
  offset: joi.number().integer().min(0),
  sortBy: joi.string().valid('id'),
  sortOrder: joi.string().valid('asc', 'desc'),
  includeDeleted: joi.boolean(),
}).required();

export async function getUnits(where: any, options?: CollectionOptions): Promise<{data: UnitClient[]; meta: any}> {

  const {error: whereErr, value: validWhere} = getUnitsWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid where object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getUnitsOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid options object: ${optionsErr.message}`);

  const {data: units, count, total} = await unitService.getUnits(validWhere, validOptions);
  logger.debug(`${units.length} units found`);

  const unitsForClient = units.map(unitService.unitAppToClient);
  
  return {
    data: unitsForClient,
    meta: {
      count,
      total
    }
  };

}


//-------------------------------------------------
// Update Unit
//-------------------------------------------------
const unitUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  label: joi.string(),
  symbol: joi.string().allow(null),
  description: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string().allow(null)
})
.min(1)
.required(); 

export async function updateUnit(id: string, updates: any): Promise<UnitClient> {

  logger.debug(`Updating used unit '${id}'`);

  const {error: validationErr, value: validUpdates} = unitUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Check the deployment exists if provided
  if (updates.belongsToDeployment) {
    await getDeployment(updates.belongsToDeployment);
  }

  const updatedUnit = await unitService.updateUnit(id, validUpdates);
  logger.debug(`Unit '${id}' updated.`);

  return unitService.unitAppToClient(updatedUnit);

}



//-------------------------------------------------
// Delete Unit
//-------------------------------------------------
export async function deleteUnit(id: string): Promise<void> {
  await unitService.deleteUnit(id);
  logger.debug(`Unit with id: '${id}' has been deleted.`);
  return;
}

