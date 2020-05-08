import * as logger from 'node-logger';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {generateId, suffixForGeneratedIds, hasIdBeenGenerated} from '../../utils/id-generator';
import {CollectionOptions} from '../common/collection-options.class';
import {ObservablePropertyClient} from './observable-property-client.class';
import {InvalidObservableProperty} from './errors/InvalidObservableProperty';
import {getDeployment} from '../deployment/deployment.service';
import * as observablePropertyService from './observable-property.service';


//-------------------------------------------------
// Create ObservableProperty
//-------------------------------------------------
const newObservablePropertySchema = joi.object({
  id: joi.string(),
  label: joi.string(),
  comment: joi.string().allow(''),
  units: joi.array().items(joi.string()),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string(),
  createdBy: joi.string()
})
.or('id', 'label')
.required();

export async function createObservableProperty(observableProperty: ObservablePropertyClient): Promise<ObservablePropertyClient> {

  logger.debug('Creating new observableProperty');

  const {error: err} = newObservablePropertySchema.validate(observableProperty);
  if (err) {
    throw new InvalidObservableProperty(err.message);
  }

  // If an id is given, then check it won't clash with any auto-generated IDs. 
  if (observableProperty.id && hasIdBeenGenerated(observableProperty.id)) {
    throw new InvalidObservableProperty(`ObservableProperty ID cannot end '${suffixForGeneratedIds}'`);
  }

  // If it doesn't have an id then assign one
  if (!observableProperty.id) {
    observableProperty.id = generateId(observableProperty.label);
  } 

  // If it does not have a label yet then simply use the id.
  if (!observableProperty.label) {
    observableProperty.label = observableProperty.id;
  }

  // Check the deployment exists if provided
  if (observableProperty.belongsToDeployment) {
    await getDeployment(observableProperty.belongsToDeployment);
  }

  // TODO: If units have been provided then check they actually exist.

  const created = await observablePropertyService.createObservableProperty(observableProperty);

  return observablePropertyService.observablePropertyAppToClient(created);

}


//-------------------------------------------------
// Get ObservableProperty
//-------------------------------------------------
const getObservablePropertyOptions = joi.object({
  includeDeleted: joi.boolean()
});

export async function getObservableProperty(id: string, options = {}): Promise<ObservablePropertyClient> {

  const {error: err, value: validOptions} = getObservablePropertyOptions.validate(options);
  if (err) throw new BadRequest(`Invalid 'options' object: ${err.message}`);

  const observableProperty = await observablePropertyService.getObservableProperty(id, validOptions);
  logger.debug('ObservableProperty found', observableProperty);
  return observablePropertyService.observablePropertyAppToClient(observableProperty);

}


//-------------------------------------------------
// Get ObservableProperties
//-------------------------------------------------
const getObservablePropertiesWhereSchema = joi.object({
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

const getObservablePropertiesOptionsSchema = joi.object({
  limit: joi.number().integer().positive(),
  offset: joi.number().integer().min(0),
  sortBy: joi.string().valid('id'),
  sortOrder: joi.string().valid('asc', 'desc'),
  includeDeleted: joi.boolean(),
}).required();

export async function getObservableProperties(where: any, options?: CollectionOptions): Promise<{data: ObservablePropertyClient[]; meta: any}> {

  const {error: whereErr, value: validWhere} = getObservablePropertiesWhereSchema.validate(where);
  if (whereErr) throw new BadRequest(`Invalid where object: ${whereErr.message}`);

  const {error: optionsErr, value: validOptions} = getObservablePropertiesOptionsSchema.validate(options);
  if (optionsErr) throw new BadRequest(`Invalid options object: ${optionsErr.message}`);

  const {data: observableProperties, count, total} = await observablePropertyService.getObservableProperties(validWhere, validOptions);
  logger.debug(`${observableProperties.length} observableProperties found`);

  const observablePropertiesForClient = observableProperties.map(observablePropertyService.observablePropertyAppToClient);
  
  return {
    data: observablePropertiesForClient,
    meta: {
      count,
      total
    }
  };

}


//-------------------------------------------------
// Update ObservableProperty
//-------------------------------------------------
const observablePropertyUpdatesSchema = joi.object({
  // There's only certain fields the client should be able to update.
  label: joi.string(),
  comment: joi.string().allow(''),
  listed: joi.boolean(),
  inCommonVocab: joi.boolean(),
  belongsToDeployment: joi.string().allow(null)
})
.min(1)
.required(); 

export async function updateObservableProperty(id: string, updates: any): Promise<ObservablePropertyClient> {

  logger.debug(`Updating used observableProperty '${id}'`);

  const {error: validationErr, value: validUpdates} = observablePropertyUpdatesSchema.validate(updates);
  if (validationErr) throw new BadRequest(validationErr.message);

  // Check the deployment exists if provided
  if (updates.belongsToDeployment) {
    await getDeployment(updates.belongsToDeployment);
  }

  const updatedObservableProperty = await observablePropertyService.updateObservableProperty(id, validUpdates);
  logger.debug(`ObservableProperty '${id}' updated.`);

  return observablePropertyService.observablePropertyAppToClient(updatedObservableProperty);

}



//-------------------------------------------------
// Delete ObservableProperty
//-------------------------------------------------
export async function deleteObservableProperty(id: string): Promise<void> {
  await observablePropertyService.deleteObservableProperty(id);
  logger.debug(`ObservableProperty with id: '${id}' has been deleted.`);
  return;
}

