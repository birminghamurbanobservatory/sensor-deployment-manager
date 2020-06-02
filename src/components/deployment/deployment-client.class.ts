// This is the format that clients and other microservices see.
export class DeploymentClient {
  public id?: string;
  public label?: string;
  public description?: string;
  public public?: boolean;
  public users?: Users[];
  public createdAt?: string;
  public updatedAt?: string;
}


class Users {
  public id: string;
  public level: string;
}