import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  gateway,
  getTeamIntegrationSession,
  mapProviderError,
  normalizeApiError,
} from '@/lib/integrations/service/integration-control-plane';

type NormalizableError = {
  code?: string;
  message?: string;
  capability?: string;
  status?: number;
};

const statusByCode = (code?: string) => {
  if (!code) return 500;
  if (code.startsWith('MISSING_CAPABILITY')) return 403;

  switch (code) {
    case 'INTEGRATION_NOT_BOUND':
      return 404;
    case 'GRANT_EXPIRED':
    case 'GRANT_REVOKED':
    case 'PROVIDER_ACCESS_DENIED':
      return 403;
    case 'PROVIDER_RESOURCE_NOT_FOUND':
      return 404;
    default:
      return 500;
  }
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
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get('integrationId');
  const teamId = searchParams.get('teamId');
  const search = searchParams.get('search');

  if (!integrationId || !teamId) {
    return NextResponse.json({ error: 'integrationId and teamId are required' }, { status: 400 });
  }

  try {
    const integrationSession = await getTeamIntegrationSession({
      integrationId,
      teamId,
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
        defaultBranch: repo.defaultBranch || 'main',
      }))
    );
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.payload, { status: apiError.status });
  }
}
