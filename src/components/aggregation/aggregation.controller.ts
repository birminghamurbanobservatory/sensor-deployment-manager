import * as logger from 'node-logger';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from '../../utils/id-generator';
import {CollectionOptions} from '../common/collection-options.class';
import {AggregationClient} from './aggregation-client.class';
import {InvalidAggregation} from './errors/InvalidAggregation';
import {getDeployment} from '../deployment/deployment.service';
import * as aggregationService from './aggregation.service';


//-------------------------------------------------
// Create Aggregation
//-------------------------------------------------
const newAggregationSchema = joi.object({
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

export async function createAggregation(aggregation: AggregationClient): Promise<AggregationClient> {

  logger.debug('Creating new aggregation');

  const {error: err} = newAggregationSchema.validate(aggregation);
  if (err) {
    throw new InvalidAggregation(err.message);
  }

  // If an id is given, then check it won't clash with any auto-generated IDs. 
  if (aggregation.id && hasIdBeenGenerated(aggregation.id)) {
    throw new InvalidAggregation(`Aggregation ID cannot end '${suffixForGeneratedIds}'`);
  }

  // If it doesn't have an id then assign one
  if (!aggregation.id) {
    aggregation.id = generateId(aggregation.label);
  } 

  // If it does not have a label yet then simply use the id.
  if (!aggregation.label) {
    aggregation.label = aggregation.id;
  }

  // Check the deployment exists if provided
  if (aggregation.belongsToDeployment) {
    await getDeployment(aggregation.belongsToDeployment);
  }

  const created = await aggregationService.createAggregation(aggregation);

  return aggregationService.aggregationAppToClient(created);

}


//-------------------------------------------------
// Get Aggregation
//-------------------------------------------------
const getAggregationOptions = joi.object({
  includeDeleted: joi.boolean()
});

export async function getAggregation(id: string, options = {}): Promise<AggregationClient> {

  const {error: err, value: validOptions} = getAggregationOptions.validate(options);
  if (err) throw new BadRequest(`Invalid 'options' object: ${err.message}`);

  const aggregation = await aggregationService.getAggregation(id, validOptions);
  logger.debug('Aggregation found', aggregation);
  return aggregationService.aggregationAppToClient(aggregation);

}


//-------------------------------------------------
// Get Aggregations
//-------------------------------------------------
const getAggregationsWhereSchema = joi.object({
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

const getAggregationsOptionsSchema = joi.object({
  limit: joi.number().integer().positive(),
  offset: joi.number().integer().min(0),
  sortBy: joi.string().valid('id'),
  sortOrder: joi.string().valid('asc', 'desc'),
  includeDeleted: joi.boolean(),
}).required();

export async function getAggregations(where: any, options?: CollectionOptions): Promise<{data: AggregationClient[]; meta: any}> {

  const {error: whereErr, value: validWhere} = getAggregationsWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid where object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getAggregationsOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid options object: ${optionsErr.message}`);

  const {data: aggregations, count, total} = await aggregationService.getAggregations(validWhere, validOptions);
  logger.debug(`${aggregations.length} aggregations found`);

  const aggregationsForClient = aggregations.map(aggregationService.aggregationAppToClient);
  
  return {
    data: aggregationsForClient,
    meta: {
      count,
      total
    }
  };

}


//-------------------------------------------------
// Update Aggregation
//-------------------------------------------------
const aggregationUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  label: joi.string(),
  comment: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string().allow(null)
})
.min(1)
.required(); 

export async function updateAggregation(id: string, updates: any): Promise<AggregationClient> {

  logger.debug(`Updating used aggregation '${id}'`);

  const {error: validationErr, value: validUpdates} = aggregationUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Check the deployment exists if provided
  if (updates.belongsToDeployment) {
    await getDeployment(updates.belongsToDeployment);
  }

  const updatedAggregation = await aggregationService.updateAggregation(id, validUpdates);
  logger.debug(`Aggregation '${id}' updated.`);

  return aggregationService.aggregationAppToClient(updatedAggregation);

}



//-------------------------------------------------
// Delete Aggregation
//-------------------------------------------------
export async function deleteAggregation(id: string): Promise<void> {
  await aggregationService.deleteAggregation(id);
  logger.debug(`Aggregation with id: '${id}' has been deleted.`);
  return;
}

