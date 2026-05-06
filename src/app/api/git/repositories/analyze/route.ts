import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import {
  gateway,
  getTeamIntegrationSession,
  mapProviderError,
  normalizeApiError,
  statusByCode,
} from '@/lib/integrations/service/integration-control-plane';
import {
  inspectRepositoryTopology,
  type MonorepoType,
  type RepositoryTopologyService,
} from '@/lib/monorepo';

interface AnalyzeResult {
  monorepoType: MonorepoType;
  hasDockerBake: boolean;
  bakeTargets: string[];
  services: RepositoryTopologyService[];
}

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

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const repositoryFullName = searchParams.get('repositoryFullName');
    const teamId = searchParams.get('teamId');
    const branch = searchParams.get('branch') || 'main';

    if (!repositoryFullName) {
      return NextResponse.json({ error: 'repositoryFullName is required' }, { status: 400 });
    }

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    const integrationSession = await getTeamIntegrationSession({
      teamId,
      actingUserId: session.user.id,
      requiredCapabilities: ['read_repo'],
    });

    const result = await inspectRepositoryTopology(
      {
        listRootFiles: (repo, ref) => gateway.listRootFiles(integrationSession, repo, ref),
        getFileContent: (repo, path, ref) =>
          gateway.getFileContent(integrationSession, repo, path, ref),
        listDirectory: (repo, path, ref) =>
          gateway.listDirectory(integrationSession, repo, path, ref),
      },
      repositoryFullName,
      branch
    );

    return NextResponse.json({
      monorepoType: result.monorepoType,
      hasDockerBake: result.hasDockerBake,
      bakeTargets: result.bakeTargets,
      services: result.services,
    } satisfies AnalyzeResult);
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.payload, { status: apiError.status });
  }
}
