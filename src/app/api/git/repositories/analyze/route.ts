import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import {
  gateway,
  getTeamIntegrationSession,
  mapProviderError,
  normalizeApiError,
  statusByCode,
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

    const result: AnalyzeResult = {
      monorepoType: 'none',
      hasDockerBake: false,
      bakeTargets: [],
      services: [],
    };

    const rootFiles = await gateway.listRootFiles(integrationSession, repositoryFullName, branch);
    result.monorepoType = detectMonorepoType(rootFiles);

    const dockerBakeContent = await gateway.getFileContent(
      integrationSession,
      repositoryFullName,
      'docker-bake.hcl',
      branch
    );

    if (dockerBakeContent) {
      result.hasDockerBake = true;
      result.bakeTargets = parseDockerBakeTargets(dockerBakeContent);
    }

    if (result.monorepoType !== 'none') {
      const appsDir = await gateway.listDirectory(
        integrationSession,
        repositoryFullName,
        'apps',
        branch
      );

      for (const app of appsDir) {
        if (app.type === 'dir') {
          const pkgContent = await gateway.getFileContent(
            integrationSession,
            repositoryFullName,
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
        repositoryFullName,
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
