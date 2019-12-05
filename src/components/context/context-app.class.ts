export class ContextApp {
  public id?: string;
  public sensor?: string;
  public startDate?: Date;
  public endDate?: Date;
  public toAdd?: ToAdd;
}


export class ToAdd {
  inDeployments?: string[];
  hostedByPath?: string[];
  observedProperty?: {value: string};
  hasFeatureOfInterest?: {value?: string; ifs?: IF[]};
  usedProcedures?: {value: string[]};
}


class IF {
  if: any;
  value: any;
}
