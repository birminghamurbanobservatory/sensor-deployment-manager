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
import replaceNullUpdatesWithUnset from '../../utils/replace-null-updates-with-unset';
import {UpdatePermanentHostFail} from './errors/UpdatePermanentHostFail';
import {GetPermanentHostsFail} from './errors/GetPermanentHostsFail';
import {whereToMongoFind} from '../../utils/where-to-mongo-find';
import {DeletePermanentHostFail} from './errors/DeletePermanentHostFail';
import {DeregisterPermanentHostFail} from './errors/DeregisterPermanentHostFail';
import {PermanentHostAlreadyRegistered} from './errors/PermanentHostAlreadyRegistered';
import {UpdatePermanentHostRegisteredAsFail} from './errors/UpdatePermanentHostRegisteredAsFail';
import {PaginationOptions} from '../common/pagination-options.interface';
import {paginationOptionsToMongoFindOptions} from '../../utils/pagination-options-to-mongo-find-options';
import * as check from 'check-types';
import {GetResourceOptions} from '../common/get-resource-options.interface';
import {PermanentHostIsDeleted} from './errors/PermanentHostIsDeleted';
import {formatDistanceToNow} from 'date-fns';


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


// TODO: Might be worth adding a 'where' argument to filter the results
export async function getPermanentHosts(where, options: PaginationOptions = {}): Promise<{data: PermanentHostApp[]; count: number; total: number}> {

  const findWhere = Object.assign(
    {}, 
    whereToMongoFind(where), 
    {
      deletedAt: {$exists: false}
    }
  );

  const findOptions = paginationOptionsToMongoFindOptions(options);
  const limitAssigned = check.assigned(options.limit);
  
  let permanentHosts;
  try {
    permanentHosts = await PermanentHost.find(findWhere, null, findOptions).exec();
  } catch (err) {
    throw new GetPermanentHostsFail(undefined, err.message);
  }

  const count = permanentHosts.length;
  let total;

  if (limitAssigned) {
    if (count < findOptions.limit && findOptions.skip === 0) {
      total = count;
    } else {
      total = await PermanentHost.countDocuments(findWhere);
    }
  } else {
    total = count;
  }

  const permanentHostsForApp = permanentHosts.map(permanentHostDbToApp);

  return {
    data: permanentHostsForApp,
    count,
    total
  };

}


export async function getPermanentHost(id: string, options: GetResourceOptions = {}): Promise<PermanentHostApp> {

  let permanentHost;
  try {
    permanentHost = await PermanentHost.findOne(
      {
        _id: id
      },
    ).exec();
  } catch (err) {
    throw new GetPermanentHostFail(undefined, err.message);
  }

  if (!permanentHost) {
    throw new PermanentHostNotFound(`A permanent host with id '${id}' could not be found`);
  }

  if (!options.includeDeleted && permanentHost.deletedAt) {
    throw new PermanentHostIsDeleted(`The permanent host with '${id}' was deleted ${formatDistanceToNow(permanentHost.deletedAt)} ago.`);
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


export async function updatePermanentHost(id: string, updates: {name?: string; description?: string; static?: boolean; updateLocationWithSensor?: string}): Promise<PermanentHostApp> {

  const modifiedUpdates = replaceNullUpdatesWithUnset(updates);

  let updatedPermanentHost;
  try {
    updatedPermanentHost = await PermanentHost.findOneAndUpdate(
      {
        _id: id,
        deletedAt: {$exists: false}
      }, 
      modifiedUpdates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new UpdatePermanentHostFail(undefined, err.message);
  }

  if (!updatedPermanentHost) {
    throw new PermanentHostNotFound(`A permanent host with id '${id}' could not be found`);
  }

  return permanentHostDbToApp(updatedPermanentHost);  

}



// A soft delete
export async function deletePermanentHost(id: string): Promise<void> {

  const updates = {
    deletedAt: new Date(),
    $unset: {
      updateLocationWithSensor: ''
    }
  };

  let deletedPermanentHost;
  try {
    deletedPermanentHost = await PermanentHost.findOneAndUpdate(
      {
        _id: id,
        deletedAt: {$exists: false}
      },
      updates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new DeletePermanentHostFail(`Failed to delete permanent host '${id}'.`, err.message);
  }

  if (!deletedPermanentHost) {
    throw new PermanentHostNotFound(`A permanent host with id '${id}' could not be found`);
  }

  return;

}


export async function updatePermanentHostRegisteredAs(permanentHostId: string, platformId: string): Promise<PermanentHostApp> {

  // We only want to allow this if registeredAs isn't already set. 
  const existingPermanentHost = await getPermanentHost(permanentHostId);

  if (existingPermanentHost.registeredAs) {
    throw new PermanentHostAlreadyRegistered(`Cannot update the registeredAs property of permanent host '${permanentHostId}' because is is already registered as ${existingPermanentHost.registeredAs}.`);
  }

  const updates = {
    registeredAs: platformId
  };

  let registeredPermanentHost;
  try {
    registeredPermanentHost = await PermanentHost.findOneAndUpdate(
      {
        _id: permanentHostId,
        deletedAt: {$exists: false}
      },
      updates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new UpdatePermanentHostRegisteredAsFail(`Failed to update the registeredAs property of permanent host '${permanentHostId}'.`, err.message);
  }

  if (!registeredPermanentHost) {
    throw new PermanentHostNotFound(`A permanent host with id '${permanentHostId}' could not be found`);
  }

  return registeredPermanentHost; 

}


export async function deregisterPermanentHost(id: string): Promise<PermanentHostApp> {

  const updates = {
    $unset: {
      registeredAs: ''
    }
  };

  let deregisteredPermanentHost;
  try {
    deregisteredPermanentHost = await PermanentHost.findOneAndUpdate(
      {
        _id: id,
        deletedAt: {$exists: false}
      },
      updates,
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new DeregisterPermanentHostFail(`Failed to delete permanent host '${id}'.`, err.message);
  }

  if (!deregisteredPermanentHost) {
    throw new PermanentHostNotFound(`A permanent host with id '${id}' could not be found`);
  }

  return deregisteredPermanentHost;

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
  permanentHostClient.createdAt = permanentHostClient.createdAt.toISOString();
  permanentHostClient.updatedAt = permanentHostClient.updatedAt.toISOString();
  if (permanentHostClient.deletedAt) {
    permanentHostClient.deletedAt = permanentHostClient.deletedAt.toISOString();
  }
  return permanentHostClient;
} 


export function permanentHostClientToApp(permanentHostClient: PermanentHostClient): PermanentHostApp {
  const permanentHostApp: any = cloneDeep(permanentHostClient);
  return permanentHostApp; 
}