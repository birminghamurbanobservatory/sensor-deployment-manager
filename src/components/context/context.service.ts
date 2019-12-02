import Context from './context.model';
import {ContextApp} from './context-app.class';
import {ContextClient} from './context-client.class';
import {GetLiveContextForSensorFail} from './errors/GetLiveContextForSensorFail';
import {ContextNotFound} from './errors/ContextNotFound';
import {cloneDeep, merge, concat, pull, pullAll, uniq} from 'lodash';
import {ContextAlreadyExists} from './errors/ContextAlreadyExists';
import {CreateContextFail} from './errors/CreateContextFail';
import {InvalidContext} from './errors/InvalidContext';
import {EndLiveContextForSensorFail} from './errors/EndLiveContextForSensorFail';
import {GetLiveContextsForPlatformFail} from './errors/GetLiveContextsForPlatformFail';
import * as check from 'check-types';
import {EndLiveContextsForPlatformsFail} from './errors/EndLiveContextsForPlatformsFail';
import * as Promise from 'bluebird';
import {GetContextFail} from './errors/GetContextFail';
import {PlatformApp} from '../platform/platform-app.class';
import {ProcessDeploymentMadePrivateFail} from './errors/ProcessDeploymentMadePrivateFail';
import {ProcessDeploymentDeletedFail} from './errors/ProcessDeploymentDeletedFail';
import {ProcessPlatformSharedWithDeploymentFail} from './errors/ProcessPlatformSharedWithDeploymentFail';
import {ProcessPlatformUnsharedWithDeploymentFail} from './errors/ProcessPlatformUnsharedWithDeploymentFail';


export async function createContext(context: ContextApp): Promise<ContextApp> {

  const contextDb = contextAppToDb(context);

  let createdContext;
  try {
    createdContext = await Context.create(contextDb);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      throw new ContextAlreadyExists(`A context for sensor '${context.sensor}' with endDate '${context.endDate}' already exists.`);
    // TODO: Check this works
    } else if (err.name === 'ValidationError') {
      throw new InvalidContext(err.message);
    } else {
      throw new CreateContextFail(undefined, err.message);
    }
  }

  return contextDbToApp(createdContext);

}


export async function getContext(id: string): Promise<ContextApp> {

  let context;
  try {
    context = await Context.findById(id).exec();
  } catch (err) {
    throw new GetContextFail(undefined, err.message);
  }

  if (!context) {
    throw new ContextNotFound(`A context with id '${id}' could not be found`);
  }

  return contextDbToApp(context);  

}


export async function getLiveContextForSensor(sensorId: string): Promise<ContextApp> {

  let context;
  try {
    context = await Context.findOne({
      sensor: sensorId,
      endDate: {$exists: false}
    }).exec();
  } catch (err) {
    throw new GetLiveContextForSensorFail(undefined, err.message);
  }

  if (!context) {
    throw new ContextNotFound(`A live context for sensor ${sensorId} could not be found`);
  }

  return contextDbToApp(context);  

}

export async function getContextForSensorAtTime(sensorId: string, time: Date): Promise<ContextApp> {

  // TODO

}


export async function getLiveContextsForPlatform(platformId: string): Promise<ContextApp> {

  let contexts;
  try {
    contexts = await Context.find({
      'toAdd.hostedByPath': platformId,
      endDate: {$exists: false}
    }).exec();
  } catch (err) {
    throw new GetLiveContextsForPlatformFail(undefined, err.message);
  }

  return contexts.map(contextDbToApp);  

}



export async function endLiveContextForSensor(sensorId: string, endDate?: object): Promise<ContextApp> {

  let updatedContext;
  try {
    updatedContext = await Context.findOneAndUpdate(
      {
        sensor: sensorId,
        endDate: {$exists: false}
      },
      {
        endDate: endDate || new Date()
      },
      {
        new: true,
        runValidators: true
      }
    ).exec();
  } catch (err) {
    throw new EndLiveContextForSensorFail(undefined, err.message);
  }

  if (!updatedContext) {
    throw new ContextNotFound(`A live context for sensor '${sensorId}' could not be found`);
  }

  return contextDbToApp(updatedContext);

}



export async function endLiveContextsForPlatform(platformId: string, endDate?: object): Promise<void> {

  try {
    await Context.updateMany(
      {
        'toAdd.hostedByPath': platformId,
        endDate: {$exists: false}
      },
      {
        endDate: endDate || new Date()
      }
    ).exec();
  } catch (err) {
    throw new EndLiveContextsForPlatformsFail(undefined, err.message);
  }

  return;

}


// When a sensor leaves a deployment the context is created from scratch again using any sensor defaults.
export async function processSensorRemovedFromDeployment(sensorId: string, sensorDefaults?: any): Promise<void> {

  const transitionDate = new Date();

  // End the current context
  await endLiveContextForSensor(sensorId, transitionDate);

  const newContext: ContextApp = {
    sensor: sensorId,
    startDate: transitionDate
  };

  if (sensorDefaults) {
    newContext.toAdd = sensorDefaults;
  }

  // Create the new context
  await createContext(newContext);

}


// I.e. stays within the same deployment.
export async function processSensorRemovedFromPlatform(sensorId: string): Promise<void> {

  const transitionDate = new Date();

  // End the current context
  const endedContext = await endLiveContextForSensor(sensorId, transitionDate);

  // We're primarily copying over the previous context but deleting the hostedByPath
  const newContext = cloneDeep(endedContext);
  newContext.startDate = transitionDate;
  delete newContext.id;
  delete newContext.toAdd.hostedByPath;
  delete newContext.endDate;

  // Create the new context
  await createContext(newContext);

  return;

}


// Works for both unhosting and rehosting.
export async function processPlatformHostChange(platformId: string, oldAncestors: string[], newAncestors: string[]): Promise<void> {

  const oldContexts = await getLiveContextsForPlatform(platformId);

  const transitionDate = new Date();

  const newContexts = oldContexts.map((oldContext) => {
    const newContext = cloneDeep(oldContext);
    delete newContext.id;
    delete newContext.endDate; // should already be missing
    newContext.startDate = transitionDate;

    if (check.nonEmptyArray(oldAncestors)) {
      pullAll(newContext.toAdd.hostedByPath, oldAncestors); // mutates
      if (newContext.toAdd.hostedByPath.length === 0) {
        delete newContext.toAdd.hostedByPath;
      }
    }

    if (check.nonEmptyArray(newAncestors)) {
      newContext.toAdd.hostedByPath = concat(newAncestors, newContext.toAdd.hostedByPath)
    }

    return newContext;
  });

  // End the old contexts
  await endLiveContextsForPlatform(platformId);

  // Save the new contexts
  await Context.create(newContexts);

  return;

}


// When a platform is made private, any sensors hosted on this deployment's platforms that are not from this deployment, nor are they hosted on a platform shared with this deployment, will need their context updating. Specially they need new contexts where the platforms being made private are removed from the hostedByPath
export async function processDeploymentMadePrivate(deploymentId: string, deploymentPlatformIds: string[]): Promise<void> {

  const transitionDate = new Date();
  let oldContexts;

  // - Find any live contexts who have these platforms in their hostedByPath AND do NOT have this deployment listed in their inDeployments array.
  try {
    const oldContextsDb = await Context.find({
      'toAdd.hostedByPath': {$in: deploymentPlatformIds},
      'toAdd.inDeployments': {$nin: [deploymentId]},
      endDate: {$exists: false}
    })
    .exec();
    oldContexts = oldContextsDb.map(contextDbToApp);
  } catch (err) {
    throw new ProcessDeploymentMadePrivateFail(undefined, err.message);
  }

  if (oldContexts.length) {

    // We need to end these contexts
    try {
      await Context.updateMany(
        {
          _id: {$in: oldContexts.map((context) => context.id)}
        },
        {
          endDate: transitionDate
        }
      ).exec();    
    } catch (err) {
      console.log(err);
      throw new ProcessDeploymentMadePrivateFail(undefined, err.message);
    }

    const newContexts: ContextApp[] = cloneDeep(oldContexts);
    newContexts.forEach((newContext) => {
      delete newContext.endDate;
      delete newContext.id;
      pullAll(newContext.toAdd.hostedByPath, deploymentPlatformIds);
      if (newContext.toAdd.hostedByPath.length === 0) {
        delete newContext.toAdd.hostedByPath;
      }
    });

    const newContextsDb = newContexts.map(contextAppToDb);

    try {
      await Context.create(newContextsDb);
    } catch (err) {
      throw new ProcessDeploymentMadePrivateFail(undefined, err.message);
    }

  }

}


export async function processDeploymentDeleted(deploymentId: string, deploymentPlatformIds: string[]): Promise<void> {

  const transitionDate = new Date();
  let oldContexts;

  // - Find any live contexts with this deploymentId
  try {
    const oldContextsDb = await Context.find({
      'toAdd.inDeployments': deploymentId,
      endDate: {$exists: false}
    })
    .exec();
    oldContexts = oldContextsDb.map(contextDbToApp);
  } catch (err) {
    throw new ProcessDeploymentDeletedFail(undefined, err.message);
  }

  if (oldContexts.length) {

    // We need to end these contexts
    try {
      await Context.updateMany(
        {
          _id: {$in: oldContexts.map((context) => context.id)}
        },
        {
          endDate: transitionDate
        }
      ).exec();    
    } catch (err) {
      throw new ProcessDeploymentDeletedFail(undefined, err.message);
    }

    const newContexts: ContextApp[] = cloneDeep(oldContexts);
    newContexts.forEach((newContext) => {
      delete newContext.endDate;
      delete newContext.id;
      if (newContext.toAdd.hostedByPath) {
        pullAll(newContext.toAdd.hostedByPath, deploymentPlatformIds);
        if (newContext.toAdd.hostedByPath.length === 0) {
          delete newContext.toAdd.hostedByPath;
        }
      }
      pull(newContext.toAdd.inDeployments, deploymentId);
      if (newContext.toAdd.inDeployments.length === 0) {
        delete newContext.toAdd.inDeployments;
      }
    });

    const newContextsDb = newContexts.map(contextAppToDb);

    try {
      await Context.create(newContextsDb);
    } catch (err) {
      throw new ProcessDeploymentDeletedFail(undefined, err.message);
    }

  }

}



// It takes the existing live context, copies it, ends it, and applies some updates in order to create a new context document from it. 
export async function changeSensorsHostedByPath(sensorId: string, hostedByPath: string[]): Promise<ContextApp> {

  const transitionDate = new Date();

  // End the current context
  const endedContext = await endLiveContextForSensor(sensorId, transitionDate);

  const newContext = merge({}, endedContext, {toAdd: {hostedByPath}});
  delete newContext.id;
  delete newContext.endDate;
  const createdContext = await createContext(newContext);
  return createdContext;

}


export async function removeSensorsHostedByPath(sensorId: string): Promise<ContextApp> {

  const transitionDate = new Date();

  // End the current context
  const endedContext = await endLiveContextForSensor(sensorId, transitionDate);

  const newContext = cloneDeep(endedContext);
  delete newContext.id;
  delete newContext.endDate;
  delete newContext.hostedByPath;
  const createdContext = await createContext(newContext);
  return createdContext;

}


export async function processPlatformSharedWithDeployment(platformId: string, deploymentId: string): Promise<void> {

  const transitionDate = new Date();
  let oldContexts;

  // Get all the existing contexts for this platform so we can copy them
  try {
    const oldContextsDb = await Context.find({
      'toAdd.hostedByPath': platformId,
      endDate: {$exists: false}
    })
    .exec();
    oldContexts = oldContextsDb.map(contextDbToApp);
  } catch (err) {
    throw new ProcessPlatformSharedWithDeploymentFail(undefined, err.message);
  }

  if (oldContexts.length) {

    // We need to end these contexts
    try {
      await Context.updateMany(
        {
          _id: {$in: oldContexts.map((context) => context.id)}
        },
        {
          endDate: transitionDate
        }
      ).exec();    
    } catch (err) {
      throw new ProcessPlatformSharedWithDeploymentFail(undefined, err.message);
    }

    const newContexts: ContextApp[] = cloneDeep(oldContexts);
    newContexts.forEach((newContext) => {
      delete newContext.endDate;
      delete newContext.id;
      newContext.toAdd.inDeployments = uniq(concat(newContext.toAdd.inDeployments, deploymentId));
    });

    const newContextsDb = newContexts.map(contextAppToDb);

    try {
      await Context.create(newContextsDb);
    } catch (err) {
      throw new ProcessPlatformSharedWithDeploymentFail(undefined, err.message);
    }

  }

}


export async function processPlatformUnsharedWithDeployment(platformId: string, deploymentId: string): Promise<void> {

  const transitionDate = new Date();
  let oldContexts;

  // Get all the existing contexts for this platform so we can copy them
  try {
    const oldContextsDb = await Context.find({
      'toAdd.inDeployments': platformId,
      endDate: {$exists: false}
    })
    .exec();
    oldContexts = oldContextsDb.map(contextDbToApp);
  } catch (err) {
    throw new ProcessPlatformUnsharedWithDeploymentFail(undefined, err.message);
  }

  if (oldContexts.length) {

    // We need to end these contexts
    try {
      await Context.updateMany(
        {
          _id: {$in: oldContexts.map((context) => context.id)}
        },
        {
          endDate: transitionDate
        }
      ).exec();    
    } catch (err) {
      throw new ProcessPlatformUnsharedWithDeploymentFail(undefined, err.message);
    }

    const newContexts: ContextApp[] = cloneDeep(oldContexts);
    newContexts.forEach((newContext) => {
      delete newContext.endDate;
      delete newContext.id;
      pull(newContext.toAdd.inDeployments, deploymentId);
    });

    const newContextsDb = newContexts.map(contextAppToDb);

    try {
      await Context.create(newContextsDb);
    } catch (err) {
      throw new ProcessPlatformUnsharedWithDeploymentFail(undefined, err.message);
    }

  }
  
}



function contextAppToDb(contextApp: ContextApp): object {
  const contextDb: any = cloneDeep(contextApp);
  return contextDb;
}


function contextDbToApp(contextDb: any): ContextApp {
  const contextApp = contextDb.toObject();
  contextApp.id = contextApp._id.toString();
  delete contextApp._id;
  delete contextApp.__v;
  return contextApp;
}


export function contextAppToClient(contextApp: ContextApp): ContextClient {
  const contextClient: any = cloneDeep(contextApp);
  return contextClient;
} 


export function contextClientToApp(contextClient: ContextClient): ContextApp {
  const contextApp: any = cloneDeep(contextClient);
  return contextApp; 
}