import {DeploymentUserApp} from '../deployment-user/deployment-user-app.class';

// This is the format that this application uses (specifically the services and controllers)
export class DeploymentApp {
  public id: string;
  public name: string;
  public description?: string;
  public public?: boolean;
  public users?: DeploymentUserApp[];
  public createdBy?: string;
  public createdAt?: string;
  public updatedAt?: string;
  public deletedAt?: string;
}

