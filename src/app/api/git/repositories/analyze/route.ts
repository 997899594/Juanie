import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { repositories } from '@/lib/db/schema';
import {
  gateway,
  getTeamIntegrationSession,
  mapProviderError,
  normalizeApiError,
} from '@/lib/integrations/service/integration-control-plane';
import { detectMonorepoType, type MonorepoType } from '@/lib/monorepo';

interface DetectedService {
  name: string;
  type: 'web' | 'worker' | 'cron';
  appDir: string;
  startCommand: string;
  port: number;
}

interface AnalyzeResult {
  monorepoType: MonorepoType;
  hasDockerBake: boolean;
  bakeTargets: string[];
  services: DetectedService[];
}

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
      : normalizeApiError(typed);

  return {
    status: statusByCode(normalized.error.code),
    payload: normalized,
  };
};

function parseDockerBakeTargets(content: string): string[] {
  const targets: string[] = [];
  const targetRegex = /target\s+["']?(\w+)["']?\s*\{/g;
  let match: RegExpExecArray | null = targetRegex.exec(content);

  while (match !== null) {
    const targetName = match[1];
    if (targetName && !['default', 'multi'].includes(targetName)) {
      targets.push(targetName);
    }
    match = targetRegex.exec(content);
  }

  return [...new Set(targets)];
}

function parseStartCommand(
  content: string,
  _serviceName: string
): { startCommand: string; port: number } {
  try {
    const pkg = JSON.parse(content);
    if (pkg.scripts?.start) {
      return { startCommand: pkg.scripts.start, port: 3000 };
    }
    if (pkg.scripts?.dev) {
      return { startCommand: pkg.scripts.dev, port: 3000 };
    }
  } catch {
    // ignore parse errors
  }
  return { startCommand: 'npm start', port: 3000 };
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get('repositoryId');
  const integrationId = searchParams.get('integrationId');
  const teamId = searchParams.get('teamId');
  const branch = searchParams.get('branch') || 'main';

  if (!repositoryId) {
    return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
  }

  if (!integrationId || !teamId) {
    return NextResponse.json({ error: 'integrationId and teamId are required' }, { status: 400 });
  }

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, repositoryId),
  });

  if (!repository) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  try {
    const integrationSession = await getTeamIntegrationSession({
      integrationId,
      teamId,
      requiredCapabilities: ['read_repo'],
    });

    const result: AnalyzeResult = {
      monorepoType: 'none',
      hasDockerBake: false,
      bakeTargets: [],
      services: [],
    };

    const rootFiles = await gateway.listRootFiles(integrationSession, repository.fullName, branch);
    result.monorepoType = detectMonorepoType(rootFiles);

    const dockerBakeContent = await gateway.getFileContent(
      integrationSession,
      repository.fullName,
      'docker-bake.hcl',
      branch
    );

    if (dockerBakeContent) {
      result.hasDockerBake = true;
      result.bakeTargets = parseDockerBakeTargets(dockerBakeContent);
    }

    if (result.monorepoType !== 'none') {
      const appsDir = await gateway.listDirectory(integrationSession, repository.fullName, 'apps', branch);

      for (const app of appsDir) {
        if (app.type === 'dir') {
          const pkgContent = await gateway.getFileContent(
            integrationSession,
            repository.fullName,
            `${app.path}/package.json`,
            branch
          );

          const { startCommand, port } = pkgContent
            ? parseStartCommand(pkgContent, app.name)
            : { startCommand: 'npm start', port: 3000 };

          result.services.push({
            name: app.name,
            type: 'web',
            appDir: app.path,
            startCommand,
            port,
          });
        }
      }
    } else if (result.hasDockerBake && result.bakeTargets.length > 0) {
      for (const target of result.bakeTargets) {
        result.services.push({
          name: target,
          type: 'web',
          appDir: '.',
          startCommand: 'npm start',
          port: 3000,
        });
      }
    } else {
      const pkgContent = await gateway.getFileContent(
        integrationSession,
        repository.fullName,
        'package.json',
        branch
      );

      const { startCommand, port } = pkgContent
        ? parseStartCommand(pkgContent, 'web')
        : { startCommand: 'npm start', port: 3000 };

      result.services.push({
        name: 'web',
        type: 'web',
        appDir: '.',
        startCommand,
        port,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.payload, { status: apiError.status });
  }
}
