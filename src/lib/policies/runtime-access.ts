import type { TeamRole } from '@/lib/db/schema';

interface EnvironmentLike {
  isProduction?: boolean | null;
}

export function canReadProjectRuntime(role: TeamRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
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
