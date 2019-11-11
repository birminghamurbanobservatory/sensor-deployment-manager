export class ContextApp {
  public id?: string;
  public sensor?: string;
  public startDate?: Date;
  public endDate?: Date;
  public toAdd?: ToAdd;
}


class ToAdd {
  inDeployments: {value: string[]};
  hostedByPath: {value: string[]};
  observedProperty: {value: string};
  hasFeatureOfInterest: {value: string; ifs: IF[]};
  usedProcedures: {value: string[]};
}


class IF {
  if: any;
  value: any;
}
