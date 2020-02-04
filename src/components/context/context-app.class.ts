export class ContextApp {
  public id?: string;
  public sensor?: string;
  public startDate?: Date;
  public endDate?: Date;
  public inDeployments?: string[];
  public hostedByPath?: string[];
  public defaults?: Default[];
}


export class Default {
  id?: string;
  observedProperty?: string;
  hasFeatureOfInterest?: string;
  usedProcedures?: string[];
  when?: When;
}

export class When {
  observedProperty?: string;
  hasFeatureOfInterest?: string;
}


