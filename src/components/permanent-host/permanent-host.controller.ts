import {PermanentHostClient} from './permanent-host-client.class';
import {generateRegistrationKey} from '../../utils/registration-keys';
import * as permanentHostService from './permanent-host.service';
import * as check from 'check-types';
import * as logger from 'node-logger';
import {nameToClientId} from '../../utils/name-to-client-id';
import {PermanentHostApp} from './permanent-host-app.class';
import {generateClientIdSuffix} from '../../utils/generate-client-id-suffix';


export async function createPermanentHost(permanentHost: PermanentHostClient): Promise<PermanentHostClient> {

  const permanentHostToCreate: PermanentHostApp = permanentHostService.permanentHostClientToApp(permanentHost);

  // If the new permanent host doesn't have an id yet, then we can autogenerate one.
  const idSpecified = check.assigned(permanentHost.id);
  if (!idSpecified) {
    permanentHostToCreate.id = nameToClientId(permanentHost.name);
    logger.debug(`The permanent host name: '${permanentHostToCreate.name}' has been converted to an id of '${permanentHostToCreate.id}'`);
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

  return createdPermanentHost;

}



export async function getPermanentHost(id: string): Promise<PermanentHostClient> {

  const permanentHost: PermanentHostApp = await permanentHostService.getPermanentHost(id);
  logger.debug('PermanentHost found', permanentHost);
  return permanentHostService.permanentHostAppToClient(permanentHost);

}