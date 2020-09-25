export class DeploymentInviteApp {
  id?: string;
  deploymentId?: string;
  deploymentLabel?: string;
  expiresIn?: number; // in minutes, incoming property
  expiresAt?: Date; // date object, outgoing property
  level?: string;
}