import type { TeamRole } from '@/lib/db/schema';
import {
  isDeployableReleaseArtifact,
  type ReleaseArtifactRecordLike,
} from '@/lib/releases/artifacts';

const contributorRoles: readonly TeamRole[] = ['owner', 'admin', 'member'];
const deliveryViewerRoles: readonly TeamRole[] = ['owner', 'admin', 'member', 'delivery'];

export function canViewProjectOverview(role: TeamRole | null | undefined): boolean {
  return Boolean(role && deliveryViewerRoles.includes(role));
}

export function canViewProjectDelivery(role: TeamRole | null | undefined): boolean {
  return Boolean(role && deliveryViewerRoles.includes(role));
}

interface EnvironmentLike {
  isProduction?: boolean | null;
}

export function canReadProjectRuntime(role: TeamRole | null | undefined): boolean {
  return Boolean(role && contributorRoles.includes(role));
}

export function canExecInEnvironment(
  role: TeamRole | null | undefined,
  _environment: EnvironmentLike
): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageConfigObjects(role: TeamRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageTeamIntegrations(role: TeamRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canDownloadReleaseArtifact(
  role: TeamRole | null | undefined,
  artifact: ReleaseArtifactRecordLike
): boolean {
  if (!role) {
    return false;
  }

  if (contributorRoles.includes(role)) {
    return true;
  }

  return role === 'delivery' && !isDeployableReleaseArtifact(artifact);
}

export function assertProjectScope(parentProjectId: string, resourceProjectId: string): void {
  if (parentProjectId !== resourceProjectId) {
    throw new Error('invalid_scope');
  }
}

export function assertTeamScope(parentTeamId: string, resourceTeamId: string): void {
  if (parentTeamId !== resourceTeamId) {
    throw new Error('invalid_scope');
  }
}
