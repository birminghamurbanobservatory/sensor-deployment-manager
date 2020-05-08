import * as logger from 'node-logger';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from '../../utils/id-generator';
import {CollectionOptions} from '../common/collection-options.class';
import {FeatureOfInterestClient} from './feature-of-interest-client.class';
import {InvalidFeatureOfInterest} from './errors/InvalidFeatureOfInterest';
import {getDeployment} from '../deployment/deployment.service';
import * as featureOfIinterestService from './feature-of-interest.service';


//-------------------------------------------------
// Create FeatureOfInterest
//-------------------------------------------------
const newFeatureOfInterestSchema = joi.object({
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

export async function createFeatureOfInterest(featureOfIinterest: FeatureOfInterestClient): Promise<FeatureOfInterestClient> {

  logger.debug('Creating new featureOfIinterest');

  const {error: err} = newFeatureOfInterestSchema.validate(featureOfIinterest);
  if (err) {
    throw new InvalidFeatureOfInterest(err.message);
  }

  // If an id is given, then check it won't clash with any auto-generated IDs. 
  if (featureOfIinterest.id && hasIdBeenGenerated(featureOfIinterest.id)) {
    throw new InvalidFeatureOfInterest(`FeatureOfInterest ID cannot end '${suffixForGeneratedIds}'`);
  }

  // If it doesn't have an id then assign one
  if (!featureOfIinterest.id) {
    featureOfIinterest.id = generateId(featureOfIinterest.label);
  } 

  // If it does not have a label yet then simply use the id.
  if (!featureOfIinterest.label) {
    featureOfIinterest.label = featureOfIinterest.id;
  }

  // Check the deployment exists if provided
  if (featureOfIinterest.belongsToDeployment) {
    await getDeployment(featureOfIinterest.belongsToDeployment);
  }

  const created = await featureOfIinterestService.createFeatureOfInterest(featureOfIinterest);

  return featureOfIinterestService.featureOfIinterestAppToClient(created);

}


//-------------------------------------------------
// Get FeatureOfInterest
//-------------------------------------------------
const getFeatureOfInterestOptions = joi.object({
  includeDeleted: joi.boolean()
});

export async function getFeatureOfInterest(id: string, options = {}): Promise<FeatureOfInterestClient> {

  const {error: err, value: validOptions} = getFeatureOfInterestOptions.validate(options);
  if (err) throw new BadRequest(`Invalid 'options' object: ${err.message}`);

  const featureOfIinterest = await featureOfIinterestService.getFeatureOfInterest(id, validOptions);
  logger.debug('FeatureOfInterest found', featureOfIinterest);
  return featureOfIinterestService.featureOfIinterestAppToClient(featureOfIinterest);

}


//-------------------------------------------------
// Get FeaturesOfInterest
//-------------------------------------------------
const getFeaturesOfInterestWhereSchema = joi.object({
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

const getFeaturesOfInterestOptionsSchema = joi.object({
  limit: joi.number().integer().positive(),
  offset: joi.number().integer().min(0),
  sortBy: joi.string().valid('id'),
  sortOrder: joi.string().valid('asc', 'desc'),
  includeDeleted: joi.boolean(),
}).required();

export async function getFeaturesOfInterest(where: any, options?: CollectionOptions): Promise<{data: FeatureOfInterestClient[]; meta: any}> {

  const {error: whereErr, value: validWhere} = getFeaturesOfInterestWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid where object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getFeaturesOfInterestOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid options object: ${optionsErr.message}`);

  const {data: featuresOfIinterest, count, total} = await featureOfIinterestService.getFeaturesOfInterest(validWhere, validOptions);
  logger.debug(`${featuresOfIinterest.length} featuresOfIinterest found`);

  const featuresOfIinterestForClient = featuresOfIinterest.map(featureOfIinterestService.featureOfIinterestAppToClient);
  
  return {
    data: featuresOfIinterestForClient,
    meta: {
      count,
      total
    }
  };

}


//-------------------------------------------------
// Update FeatureOfInterest
//-------------------------------------------------
const featureOfIinterestUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  label: joi.string(),
  comment: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string().allow(null)
})
.min(1)
.required(); 

export async function updateFeatureOfInterest(id: string, updates: any): Promise<FeatureOfInterestClient> {

  logger.debug(`Updating used featureOfIinterest '${id}'`);

  const {error: validationErr, value: validUpdates} = featureOfIinterestUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Check the deployment exists if provided
  if (updates.belongsToDeployment) {
    await getDeployment(updates.belongsToDeployment);
  }

  const updatedFeatureOfInterest = await featureOfIinterestService.updateFeatureOfInterest(id, validUpdates);
  logger.debug(`FeatureOfInterest '${id}' updated.`);

  return featureOfIinterestService.featureOfIinterestAppToClient(updatedFeatureOfInterest);

}



//-------------------------------------------------
// Delete FeatureOfInterest
//-------------------------------------------------
export async function deleteFeatureOfInterest(id: string): Promise<void> {
  await featureOfIinterestService.deleteFeatureOfInterest(id);
  logger.debug(`FeatureOfInterest with id: '${id}' has been deleted.`);
  return;
}

