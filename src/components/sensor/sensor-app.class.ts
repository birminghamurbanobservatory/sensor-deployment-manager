export class SensorApp {
  public id: string;
  public name?: string;
  public description?: string;
  public hasDeployment?: string;
  public isHostedBy?: string;
  public permanentHost?: string;
  public initialConfig?: Config[];
  public currentConfig?: Config[];
  public createdAt?: string;
  public updatedAt?: string;
  public type?: string; // for when in a platform's 'hosts' array
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
