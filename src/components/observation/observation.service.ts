import {cloneDeep} from 'lodash';
import {ObservationApp} from './observation-app.class';
import {ObservationClient} from './observation-client.class';



export function observationClientToApp(observationClient: ObservationClient): ObservationApp {
  const observationApp: any = cloneDeep(observationClient);
  observationApp.resultTime = new Date(observationApp.resultTime);
  if (observationApp.location && observationApp.location.validAt) {
    observationApp.location.validAt = new Date(observationApp.location.validAt);
  }  
  return observationApp;
} 


export function observationAppToClient(observationApp: ObservationApp): ObservationClient {
  const observationClient: any = cloneDeep(observationApp);
  observationClient.resultTime = observationClient.resultTime.toISOString();
  if (observationClient.location && observationClient.location.validAt) {
    observationClient.location.validAt = observationClient.location.validAt.toISOString();
  }  
  return observationClient;
} 