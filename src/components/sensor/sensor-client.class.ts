import {SensorConfigClient} from './sensor-config-client';

export class SensorClient {
  public id?: string;
  public label?: string;
  public description?: string;
  public hasDeployment?: string;
  public isHostedBy?: string;
  public permanentHost?: string;
  public initialConfig?: SensorConfigClient[];
  public currentConfig?: SensorConfigClient[];
  public createdAt?: string;
  public updatedAt?: string;
  public type?: string; // for when in a platform's 'hosts' array
}
