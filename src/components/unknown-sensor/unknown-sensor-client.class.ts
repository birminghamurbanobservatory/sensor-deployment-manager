import {ObservationClient} from '../observation/observation-client.class';

export class UnknownSensorClient {
  public id: string;
  public nObservations?: string;
  public lastObservation: ObservationClient;
  public createdAt?: string;
  public updatedAt?: string;
}

