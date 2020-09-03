// This is the format that this application uses (specifically the services and controllers)
export class PermanentHostApp {
  public id?: string;
  public label?: string;
  public description?: string;
  public static?: boolean;
  public updateLocationWithSensor?: string;
  public passLocationToObservations?: boolean; 
  public registrationKey?: string;
  public registeredAs?: string;
  public createdAt?: Date;
  public updatedAt?: Date;
  public deletedAt?: Date;
}

