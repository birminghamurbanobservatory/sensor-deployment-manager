export class ContextClient {
  public id?: string;
  public sensor?: string;
  public startDate?: Date;
  public endDate?: Date;
  public toAdd?: ToAdd;
}

// TODO: Do I even need this? Will there ever be a request for the actual context document or is it more a case of other microservices sending their observations to this microservice and expecting to receive the observation back, but now with extra context properties added.

class ToAdd {
  inDeployments?: {value: string[]};
  hostedByPath?: {value: string[]};
  observedProperty?: {value: string};
  hasFeatureOfInterest?: {value: string; ifs?: IF[]};
  usedProcedures?: {value: string[]};
}


class IF {
  if: any;
  value: any;
}