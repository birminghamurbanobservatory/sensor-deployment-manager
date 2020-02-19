import {ObservationClient} from '../observation/observation-client.class';

export class UnknownSensorApp {
  public id: string;
  public nObservations?: string;
  public lastObservation: ObservationClient; // I want this to be client not app
  public createdAt?: string;
  public updatedAt?: string;
}

