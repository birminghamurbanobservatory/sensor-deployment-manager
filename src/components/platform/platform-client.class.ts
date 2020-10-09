// This is the format that clients and other microservices see.
export class PlatformClient {
  public id?: string;
  public label: string;
  public description?: string;
  public inDeployment?: string;
  public isHostedBy?: string;
  public hostedByPath?: string[];
  public topPlatform?: string;
  public hosts?: any[];
  public initialisedFrom?: string;
  public static?: boolean;
  public location?: Location;
  public updateLocationWithSensor?: string;
  public passLocationToObservations?: boolean;
  public createdAt?: string;
  public updatedAt?: string;
  public deletedAt?: string;
  public type?: string; // for when in a platform's 'hosts' array
}


class Location {
  public id?: string;
  public geometry?: Geometry;
  public height?: number;
  public validAt?: string;
}

class Geometry {
 public type: string;
 public coordinates: any;
}
