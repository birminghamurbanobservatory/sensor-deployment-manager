export class SensorApp {
  public id: string;
  public name?: string;
  public description?: string;
  public inDeployment?: string;
  public isHostedBy?: string;
  public permanentHost?: string;
  public defaults?: Default[]; 
  public createdAt?: string;
  public updatedAt?: string;
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