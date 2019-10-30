// This is the format that clients and other microservices see.
export class DeploymentClient {
  public id: string;
  public name: string;
  public description?: string;
  public public?: boolean;
  public createdAt?: string;
  public updatedAt?: string
}