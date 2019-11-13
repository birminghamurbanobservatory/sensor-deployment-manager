import Context from './context.model';
import {ContextApp} from './context-app.class';
import {ContextClient} from './context-client.class';
import {GetLiveContextForSensorFail} from './errors/GetLiveContextForSensorFail';
import {ContextNotFound} from './errors/ContextNotFound';
import {cloneDeep, merge} from 'lodash';
import {ContextAlreadyExists} from './errors/ContextAlreadyExists';
import {CreateContextFail} from './errors/CreateContextFail';
import {InvalidContext} from './errors/InvalidContext';
import {EndLiveContextForSensorFail} from './errors/EndLiveContextForSensorFail';




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



// It takes the existing live context, copies it, ends it, and applies some updates in order to create a new context document from it. 
export async function tweakLiveContext(sensorId: string, updates: {hostedByPath: string; observedProperty: string; hasFeatureOfInterest: string}): Promise<ContextApp> {

  const transitionDate = new Date();

  // End the current context
  const endedContext = await endLiveContextForSensor(sensorId, transitionDate);

  const newContext = merge({}, endedContext, {toAdd: updates});
  delete newContext.id;
  delete newContext.endDate;

  return newContext;

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