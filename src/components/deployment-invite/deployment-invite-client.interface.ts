export class DeploymentInviteClient {
  id?: string;
  deploymentId?: string;
  deploymentLabel?: string;
  expiresIn?: number; // in minutes, incoming property
  expiresAt?: string; // ISO8601 date string, outgoing property
  level?: string;
}