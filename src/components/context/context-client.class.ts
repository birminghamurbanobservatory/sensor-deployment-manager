// TODO: Do I even need this? Will there ever be a request for the actual context document or is it more a case of other microservices sending their observations to this microservice and expecting to receive the observation back, but now with extra context properties added.
export class ContextClient {
  public id?: string;
  public sensor?: string;
  public startDate?: Date;
  public endDate?: Date;
  public hasDeployment: string;
  public hostedByPath?: string[];
  public config: Config[];
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



