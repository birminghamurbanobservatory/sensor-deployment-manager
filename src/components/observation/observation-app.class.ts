export class ObservationApp {
  public id?: string;
  public madeBySensor?: string;
  public hasResult?: Result;
  public hostedByPath?: string[];
  public inDeployments?: string[];
  public resultTime?: Date;
  public hasFeatureOfInterest?: string;
  public location?: Location;
  public observedProperty?: string;
  public usedProcedures?: string[];
}

class Result {
  value?: any;
  flags?: string[];
}

class Location {
  public id?: string;
  public geometry?: Geometry;
  public validAt?: Date;
}

class Geometry {
  type?: string;
  coordinates?: any;
}