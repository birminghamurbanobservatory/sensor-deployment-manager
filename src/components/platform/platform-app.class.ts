// This is the format that this application uses (specifically the services and controllers)
export class PlatformApp {
  public id?: string;
  public name: string;
  public description?: string;
  public ownerDeployment?: string;
  public inDeployments?: string[];
  public isHostedBy?: string;
  public hostedByPath?: string[];
  public initialisedFrom?: string;
  public static?: boolean;
  public location?: Location;
  public centroid?: Centroid;
  public updateLocationWithSensor?: string;
  public createdAt?: string;
  public updatedAt?: string;
  public deletedAt?: string;
}


class Location {
  public id?: string;
  public geometry?: Geometry;
  public validAt?: Date;
}

class Geometry {
 public type: string;
 public coordinates: any;
}

class Centroid {
  public lat: number;
  public lng: number;
  public height?: number
}