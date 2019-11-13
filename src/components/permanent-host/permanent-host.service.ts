import {cloneDeep} from 'lodash';
import PermanentHost from './permanent-host.model';
import {PermanentHostApp} from './permanent-host-app.class';
import {PermanentHostAlreadyExists} from './errors/PermanentHostAlreadyExists';
import {InvalidPermanentHost} from './errors/InvalidPermanentHost';
import {CreatePermanentHostFail} from './errors/CreatePermanentHostFail';
import {PermanentHostClient} from './permanent-host-client.class';
import {GetPermanentHostFail} from './errors/GetPermanentHostFail';
import {PermanentHostNotFound} from './errors/PermanentHostNotFound';
import {GetPermanentHostByRegistrationKeyFail} from './errors/GetPermanentHostByRegistrationKeyFail';


export async function createPermanentHost(permanentHost: PermanentHostApp): Promise<PermanentHostApp> {

  const permanentHostDb = permanentHostAppToDb(permanentHost);

  let createdPermanentHost;
  try {
    createdPermanentHost = await PermanentHost.create(permanentHostDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new PermanentHostAlreadyExists(`A permanent host with an id of ${permanentHost.id} already exists.`);
    } else if (err.name === 'ValidationError') {
      throw new InvalidPermanentHost(err.message);
    } else {
      throw new CreatePermanentHostFail(undefined, err.message);
    }
  }

  return permanentHostDbToApp(createdPermanentHost);

}


export async function getPermanentHost(id: string): Promise<PermanentHostApp> {

  let permanentHost;
  try {
    permanentHost = await PermanentHost.findById(id).exec();
  } catch (err) {
    throw new GetPermanentHostFail(undefined, err.message);
  }

  if (!permanentHost) {
    throw new PermanentHostNotFound(`A permanent host with id '${id}' could not be found`);
  }

  return permanentHostDbToApp(permanentHost);

}


export async function getPermanentHostByRegistrationKey(registrationKey: string): Promise<PermanentHostApp> {

  let permanentHost;
  try {
    permanentHost = await PermanentHost.findOne({
      registrationKey
    }).exec();
  } catch (err) {
    throw new GetPermanentHostByRegistrationKeyFail(undefined, err.message);
  }

  if (!permanentHost) {
    throw new PermanentHostNotFound(`A permanent host with a registration key of '${registrationKey}' could not be found`);
  }

  return permanentHostDbToApp(permanentHost);

}



function permanentHostAppToDb(permanentHostApp: PermanentHostApp): object {
  const permanentHostDb: any = cloneDeep(permanentHostApp);
  permanentHostDb._id = permanentHostApp.id;
  delete permanentHostDb.id;
  return permanentHostDb;
}


function permanentHostDbToApp(permanentHostDb: any): PermanentHostApp {
  const permanentHostApp = permanentHostDb.toObject();
  permanentHostApp.id = permanentHostApp._id.toString();
  delete permanentHostApp._id;
  delete permanentHostApp.__v;
  return permanentHostApp;
}


export function permanentHostAppToClient(permanentHostApp: PermanentHostApp): PermanentHostClient {
  const permanentHostClient: any = cloneDeep(permanentHostApp);
  return permanentHostClient;
} 


export function permanentHostClientToApp(permanentHostClient: PermanentHostClient): PermanentHostApp {
  const permanentHostApp: any = cloneDeep(permanentHostClient);
  return permanentHostApp; 
}