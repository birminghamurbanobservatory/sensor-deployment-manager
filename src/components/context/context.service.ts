import Context from './context.model';
import {ContextApp} from './context-app.class';
import {ContextClient} from './context-client.class';
import {GetLiveContextForSensorFail} from './errors/GetLiveContextForSensorFail';
import {ContextNotFound} from './errors/ContextNotFound';
import {cloneDeep} from 'lodash';
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
    await Context.findOneAndUpdate(
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


// Don't use this to change the deployment as in this case we need to revert back to the sensor defaults.
export async function updateLiveContext(sensorId: string, updates: {hostedByPath: string; observedProperty: string; hasFeatureOfInterest: string}): Promise<ContextApp> {
  // TODO
  // Make sure what you're actually doing ending the current live context and copying over most of it's properties whilst updating the few properties passed in as updates to this function.
  // Do I use this function to update the ifs too?
}



function contextAppToDb(contextApp: ContextApp): object {
  const contextDb: any = cloneDeep(contextApp);
  return contextDb;
}


function contextDbToApp(contextDb: any): ContextApp {
  const contextApp = contextDb.toObject();
  contextApp.id = contextApp._id;
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