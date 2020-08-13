import * as logger from 'node-logger';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from '../../utils/id-generator';
import {CollectionOptions} from '../common/collection-options.interface';
import {FeatureOfInterestClient} from './feature-of-interest-client.class';
import {InvalidFeatureOfInterest} from './errors/InvalidFeatureOfInterest';
import {getDeployment} from '../deployment/deployment.service';
import * as featureOfInterestService from './feature-of-interest.service';
import {validateGeometry} from '../../utils/geojson-validator';


//-------------------------------------------------
// Create FeatureOfInterest
//-------------------------------------------------
const featureOfInterestLocationSchema = joi.object({
  height: joi.number(),
  geometry: joi.object({
    type: joi.string().valid('Point', 'LineString', 'Polygon').required(),
    // I don't want a z-coordinate in this coordinates array, this should come separately.
    coordinates: joi.array().required()
  })
  .custom((value) => {
    validateGeometry(value); // throws an error if invalid
    return value;
  })
  .required()
});

const newFeatureOfInterestSchema = joi.object({
  id: joi.string(),
  label: joi.string(),
  description: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string(),
  createdBy: joi.string(),
  location: featureOfInterestLocationSchema
})
.or('id', 'label')
.required();

export async function createFeatureOfInterest(featureOfInterest: FeatureOfInterestClient): Promise<FeatureOfInterestClient> {

  logger.debug('Creating new featureOfInterest');

  const {error: err} = newFeatureOfInterestSchema.validate(featureOfInterest);
  if (err) {
    throw new InvalidFeatureOfInterest(err.message);
  }

  const toCreate = featureOfInterestService.featureOfInterestClientToApp(featureOfInterest);

  // If an id is given, then check it won't clash with any auto-generated IDs. 
  if (toCreate.id && hasIdBeenGenerated(toCreate.id)) {
    throw new InvalidFeatureOfInterest(`FeatureOfInterest ID cannot end '${suffixForGeneratedIds}'`);
  }

  // If it doesn't have an id then assign one
  if (!toCreate.id) {
    toCreate.id = generateId(toCreate.label);
  } 

  // If it does not have a label yet then simply use the id.
  if (!toCreate.label) {
    toCreate.label = toCreate.id;
  }

  // Check the deployment exists if provided
  if (toCreate.belongsToDeployment) {
    await getDeployment(toCreate.belongsToDeployment);
  }

  if (toCreate.location) {
    toCreate.location = featureOfInterestService.completeFeatureOfInterestLocation(toCreate.location);
  }

  const created = await featureOfInterestService.createFeatureOfInterest(toCreate);

  return featureOfInterestService.featureOfInterestAppToClient(created);

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

  const featureOfInterest = await featureOfInterestService.getFeatureOfInterest(id, validOptions);
  logger.debug('FeatureOfInterest found', featureOfInterest);
  return featureOfInterestService.featureOfInterestAppToClient(featureOfInterest);

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

export async function getFeaturesOfInterest(where: any = {}, options: CollectionOptions = {}): Promise<{data: FeatureOfInterestClient[]; meta: any}> {

  const {error: whereErr, value: validWhere} = getFeaturesOfInterestWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid where object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getFeaturesOfInterestOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid options object: ${optionsErr.message}`);

  const {data: featuresOfIinterest, count, total} = await featureOfInterestService.getFeaturesOfInterest(validWhere, validOptions);
  logger.debug(`${featuresOfIinterest.length} featuresOfIinterest found`);

  const featuresOfIinterestForClient = featuresOfIinterest.map(featureOfInterestService.featureOfInterestAppToClient);
  
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
const featureOfInterestUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  label: joi.string(),
  description: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string().allow(null),
  location: featureOfInterestLocationSchema
})
.min(1)
.required();

export async function updateFeatureOfInterest(id: string, updates: any): Promise<FeatureOfInterestClient> {

  logger.debug(`Updating used featureOfInterest '${id}'`);

  const {error: validationErr, value: validUpdates} = featureOfInterestUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Check the deployment exists if provided
  if (updates.belongsToDeployment) {
    await getDeployment(updates.belongsToDeployment);
  }

  if (validUpdates.location) {
    validUpdates.location = featureOfInterestService.completeFeatureOfInterestLocation(validUpdates.location);
  }

  const updatedFeatureOfInterest = await featureOfInterestService.updateFeatureOfInterest(id, validUpdates);
  logger.debug(`FeatureOfInterest '${id}' updated.`);

  return featureOfInterestService.featureOfInterestAppToClient(updatedFeatureOfInterest);

}



//-------------------------------------------------
// Delete FeatureOfInterest
//-------------------------------------------------
export async function deleteFeatureOfInterest(id: string): Promise<void> {
  await featureOfInterestService.deleteFeatureOfInterest(id);
  logger.debug(`FeatureOfInterest with id: '${id}' has been deleted.`);
  return;
}

