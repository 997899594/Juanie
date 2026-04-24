import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import {
  gateway,
  getTeamIntegrationSession,
  mapProviderError,
  normalizeApiError,
  statusByCode,
} from '@/lib/integrations/service/integration-control-plane';
import { getRepositoryDefaultBranch } from '@/lib/projects/context';

type NormalizableError = {
  code?: string;
  message?: string;
  capability?: string;
  status?: number;
};

const toApiError = (error: unknown) => {
  const typed = (error ?? {}) as NormalizableError;
  const normalized =
    typeof typed.status === 'number'
      ? normalizeApiError(mapProviderError({ status: typed.status, message: typed.message }))
      : normalizeApiError({
          code: typed.code as any,
          message: typed.message,
          capability: typed.capability,
        });

  return {
    status: statusByCode(normalized.error.code),
    payload: normalized,
  };
};

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');
    const teamId = searchParams.get('teamId');
    const search = searchParams.get('search');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    const integrationSession = await getTeamIntegrationSession({
      integrationId: integrationId || undefined,
      teamId,
      actingUserId: session.user.id,
      requiredCapabilities: ['read_repo'],
    });

    const repositories = await gateway.listRepositories(integrationSession, {
      search: search || undefined,
      perPage: 100,
    });

    return NextResponse.json(
      repositories.map((repo) => ({
        id: repo.id,
        fullName: repo.fullName,
        name: repo.name,
        defaultBranch: getRepositoryDefaultBranch(repo),
      }))
    );
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.payload, { status: apiError.status });
  }
}
