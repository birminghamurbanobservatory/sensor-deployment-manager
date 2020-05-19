import {SensorConfigApp} from './sensor-config-app';

export class SensorApp {
  public id: string;
  public name?: string;
  public description?: string;
  public hasDeployment?: string;
  public isHostedBy?: string;
  public permanentHost?: string;
  public initialConfig?: SensorConfigApp[];
  public currentConfig?: SensorConfigApp[];
  public createdAt?: string;
  public updatedAt?: string;
  public type?: string; // for when in a platform's 'hosts' array
}


