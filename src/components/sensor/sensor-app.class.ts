export class SensorApp {
  public id: string;
  public name?: string;
  public description?: string;
  public inDeployment?: string;
  public isHostedBy?: string;
  public permanentHost?: string;
  public defaults?: Defaults; 
  public createdAt?: string;
  public deletedAt?: string;
}

class Defaults {
  observedProperty?: {value: string};
  hasFeatureOfInterest?: {value: string; ifs?: IF[]};
  usedProcedures?: {value: string[]};  
}

class IF {
  if: any;
  value: any;
}