import {PermanentHostClient} from './permanent-host-client.class';
import {generateRegistrationKey} from '../../utils/registration-keys';
import * as permanentHostService from './permanent-host.service';
import * as check from 'check-types';
import * as logger from 'node-logger';
import {nameToClientId} from '../../utils/name-to-client-id';
import {PermanentHostApp} from './permanent-host-app.class';
import {generateClientIdSuffix} from '../../utils/generate-client-id-suffix';
import {SensorNotFound} from '../sensor/errors/SensorNotFound';
import {getSensor, getSensors} from '../sensor/sensor.service';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';
import {InvalidPermanentHost} from './errors/InvalidPermanentHost';
import {Forbidden} from '../../errors/Forbidden';
import {SensorsRemainOnPermanentHost} from './errors/SensorsRemainOnPermanentHost';
import {PaginationOptions} from '../common/pagination-options.class';


const newPermanentHostSchema = joi.object({
  id: joi.string(),
  name: joi.string(),
  description: joi.string().allow(''),
  static: joi.boolean()
  // N.B. updateLocationWithSensor is not allow here, as the client first has to create this permanent host in order to add locational sensors to it and then it can be updated to use one of these sensors for location.
})
.or('id', 'name')
.required();

export async function createPermanentHost(permanentHost: PermanentHostClient): Promise<PermanentHostClient> {

  const {error: err} = newPermanentHostSchema.validate(permanentHost);
  if (err) {
    throw new InvalidPermanentHost(err.message);
  }

  const permanentHostToCreate: PermanentHostApp = permanentHostService.permanentHostClientToApp(permanentHost);

  // If the new permanent host doesn't have an id yet, then we can autogenerate one.
  const idSpecified = check.assigned(permanentHost.id);
  if (!idSpecified) {
    permanentHostToCreate.id = nameToClientId(permanentHost.name);
    logger.debug(`The permanent host name: '${permanentHostToCreate.name}' has been converted to an id of '${permanentHostToCreate.id}'`);
  }

  // If it doesn't yet have a name then we'll just use the id as the name
  const nameSpecified = check.assigned(permanentHost.name);
  if (!nameSpecified) {
    // Use slice just in case the id is too long to use as the name.
    permanentHostToCreate.name = permanentHost.id.slice(0, 44);
  }

  // Generate a registration key
  permanentHostToCreate.registrationKey = generateRegistrationKey();

  let createdPermanentHost;
  try {
    createdPermanentHost = await permanentHostService.createPermanentHost(permanentHostToCreate);
  } catch (err) {
    if (!idSpecified && err.name === 'PermanentHostAlreadyExists') {
      // If the id we allocated is already taken then add a random string on the end and try again.
      permanentHostToCreate.id = `${permanentHostToCreate.id}-${generateClientIdSuffix()}`;
      createdPermanentHost = await permanentHostService.createPermanentHost(permanentHostToCreate);
    } else {
      throw err;
    }
  }

  const permanentHostForClient = permanentHostService.permanentHostAppToClient(createdPermanentHost);
  return permanentHostForClient;

}



export async function getPermanentHost(id: string): Promise<PermanentHostClient> {

  const permanentHost: PermanentHostApp = await permanentHostService.getPermanentHost(id);
  logger.debug('PermanentHost found', permanentHost);
  return permanentHostService.permanentHostAppToClient(permanentHost);

}


const getPermanentHostWhereScema = joi.object({
  id: joi.object({
    begins: joi.string()
  }),
  search: joi.string()
});

export async function getPermanentHosts(where: any, options: PaginationOptions = {}): Promise<{data: PermanentHostClient[]; meta: any}> {

  const {error: err, value: validWhere} = getPermanentHostWhereScema.validate(where);
  if (err) throw new BadRequest(`Invalid 'where' object: ${err.message}`);

  const {data: permanentHosts, count, total} = await permanentHostService.getPermanentHosts(validWhere, options);
  logger.debug(`${permanentHosts.length} permanent hosts found`);
  const permanentHostsForClient = permanentHosts.map(permanentHostService.permanentHostAppToClient);

  return {
    data: permanentHostsForClient,
    meta: {
      count,
      total
    }
  };

}


// Allow updates to permanent hosts, e.g. changing the name, description or updateLocationWithSensor (with this the listed sensor's permanentHost must match the permanentHost being updated).
const updatePermanentHostSchema = joi.object({
  name: joi.string(),
  description: joi.string().allow(''),
  static: joi.boolean(),
  updateLocationWithSensor: joi.string().allow(null)
})
.required();

export async function updatePermanentHost(id: string, updates: {name?: string; description?: string; static?: boolean; updateLocationWithSensor?: string}): Promise<PermanentHostClient> {

  const {error: validationError} = updatePermanentHostSchema.validate(updates);
  if (validationError) {
    throw new BadRequest(validationError.message);
  }

  let sensor;
  if (updates.updateLocationWithSensor) {
    // Check this sensor exists
    try {
      sensor = await getSensor(updates.updateLocationWithSensor);
    } catch (err) {
      throw new SensorNotFound(`The sensor '${updates.updateLocationWithSensor}' set as the 'updateLocationWithSensor' property could not be found.`);
    }

    // This sensor must be hosted on this permanent host for it to be used
    if (sensor.permanentHost !== id) {
      throw new Forbidden(`The sensor ${updates.updateLocationWithSensor} is not hosted on the permanent host '${id}', therefore it cannot be used to update its location.'`);
    }
  }

  const existingPermanentHost = await getPermanentHost(id);

  // We don't want updateLocationWithSensor being set when static is true.
  const netResult = Object.assign({}, existingPermanentHost, updates);

  if (netResult.static === true && netResult.updateLocationWithSensor) {
    throw new BadRequest(`This update would result produce a permanent host which is static, but also has 'updateLocationWithSensor' defined, this is not permitted.`);
  }

  const updatedPermanentHost = await permanentHostService.updatePermanentHost(id, updates);
  const updatedPermanentHostForClient = permanentHostService.permanentHostAppToClient(updatedPermanentHost);
  return updatedPermanentHostForClient;

}



export async function deletePermanentHost(id: string): Promise<void> {

  // Don't allow it to be deleted if there are still sensors bound to it.
  const {data: hostedSensors} = await getSensors({permanentHost: id});
  if (hostedSensors.length > 0) {
    const sensorIds = hostedSensors.map((sensor) => sensor.id);
    throw new SensorsRemainOnPermanentHost(`Cannot be deleted until the following sensors have been removed from this permanent host: ${sensorIds.join(',')}.`);
  }

  logger.debug(`Deleting permanent host '${id}'`);
  await permanentHostService.deletePermanentHost(id);
  logger.debug(`Permanent host '${id}' deleted`);
  
  return;

}