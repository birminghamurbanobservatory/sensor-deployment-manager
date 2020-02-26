export class ContextApp {
  public id?: string;
  public sensor?: string;
  public startDate?: Date;
  public endDate?: Date;
  public inDeployments?: string[];
  public hostedByPath?: string[];
  public config?: Config[];
}


export class Config {
  id?: string;
  hasPriority?: boolean;
  observedProperty?: string;
  hasFeatureOfInterest?: string;
  discipline?: string[];
  usedProcedure?: string[];
}


