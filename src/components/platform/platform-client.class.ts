// This is the format that clients and other microservices see.
export class PlatformClient {
  public id?: string;
  public name: string;
  public description?: string;
  public ownerDeployment?: string;
  public inDeployments?: string[];
  public isHostedBy?: string;
  public hostedByPath?: string[];
  public static?: boolean;
  public createdAt?: string;
  public updatedAt?: string;
  public deletedAt?: string;
  public location?: any;
}