import {LocationApp} from '../platform-location/location-app.class';

// This is the format that this application uses (specifically the services and controllers)
export class PlatformApp {
  public id: string;
  public name: string;
  public description?: string;
  public ownerDeployment?: string;
  public inDeployments?: string[];
  public isHostedBy?: string;
  public hostedByPath?: string;
  public static?: boolean;
  public initialisedFrom?: string;
  public createdAt?: string;
  public updatedAt?: string;
  public deletedAt?: string;
  public location?: LocationApp;
}

