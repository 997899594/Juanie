import {
  getProjectAccessOrThrow,
  getProjectEnvironmentOrThrow,
  getProjectWithRepositoryAccessOrThrow,
  getTeamAccessOrThrow,
} from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';

async function resolvePageAccessOrNull<T>(loader: () => Promise<T>): Promise<T | null> {
  try {
    return await loader();
  } catch (error) {
    if (isAccessError(error)) {
      return null;
    }

    throw error;
  }
}

export function getTeamAccessOrNull(teamId: string, userId: string) {
  return resolvePageAccessOrNull(() => getTeamAccessOrThrow(teamId, userId));
}

export function getProjectAccessOrNull(projectId: string, userId: string) {
  return resolvePageAccessOrNull(() => getProjectAccessOrThrow(projectId, userId));
}

export function getProjectWithRepositoryAccessOrNull(projectId: string, userId: string) {
  return resolvePageAccessOrNull(() => getProjectWithRepositoryAccessOrThrow(projectId, userId));
}

export function getProjectEnvironmentOrNull(projectId: string, environmentId: string) {
  return resolvePageAccessOrNull(() => getProjectEnvironmentOrThrow(projectId, environmentId));
}
