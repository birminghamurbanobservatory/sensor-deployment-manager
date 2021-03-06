export class ContextApp {
  public id?: string;
  public sensor?: string;
  public startDate?: Date;
  public endDate?: Date;
  public hasDeployment?: string;
  public hostedByPath?: any[];
  public config?: Config[];
}


export class Config {
  id?: string;
  hasPriority?: boolean;
  observedProperty?: string;
  unit?: string;
  hasFeatureOfInterest?: string;
  disciplines?: string[];
  usedProcedures?: string[];
}


