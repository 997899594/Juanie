import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import { parseJuanieConfig } from '@/lib/config/parser';
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
  schedule?: string;
  build?: {
    strategy?: 'auto' | 'dockerfile' | 'bake' | 'buildpacks';
    command?: string;
    dockerfile?: string;
    context?: string;
    target?: string;
    definition?: string;
  };
  run?: {
    command: string;
    port?: number;
  };
  healthcheck?: {
    path?: string;
    interval?: number;
  };
  scaling?: {
    min?: number;
    max?: number;
    cpu?: number;
  };
  resources?: {
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
  };
  isPublic?: boolean;
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

function toDetectedService(
  service: ReturnType<typeof parseJuanieConfig>['services'][number]
): DetectedService {
  return {
    name: service.name,
    type: service.type,
    appDir: service.monorepo?.appDir ?? '.',
    startCommand: service.run.command,
    port: service.run.port ?? 3000,
    schedule: service.schedule,
    build: service.build
      ? {
          strategy: service.build.strategy,
          command: service.build.command,
          dockerfile: service.build.dockerfile,
          context: service.build.context,
          target: service.build.target,
          definition: service.build.definition,
        }
      : undefined,
    run: {
      command: service.run.command,
      ...(typeof service.run.port === 'number' ? { port: service.run.port } : {}),
    },
    healthcheck: service.healthcheck,
    scaling: service.scaling,
    resources: service.resources,
    isPublic: service.isPublic,
  };
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

    const [
      managedConfigContent,
      managedConfigAltContent,
      dockerBakeHclContent,
      dockerBakeJsonContent,
    ] = await Promise.all([
      gateway.getFileContent(integrationSession, repositoryFullName, 'juanie.yaml', branch),
      gateway.getFileContent(integrationSession, repositoryFullName, 'juanie.yml', branch),
      gateway.getFileContent(integrationSession, repositoryFullName, 'docker-bake.hcl', branch),
      gateway.getFileContent(integrationSession, repositoryFullName, 'docker-bake.json', branch),
    ]);

    const managedConfigContentResolved = managedConfigContent ?? managedConfigAltContent;
    if (managedConfigContentResolved) {
      const parsedConfig = parseJuanieConfig(managedConfigContentResolved);
      if (parsedConfig.isValid && parsedConfig.services.length > 0) {
        result.services = parsedConfig.services.map(toDetectedService);
        return NextResponse.json(result);
      }
    }

    const dockerBakeContent = dockerBakeHclContent ?? dockerBakeJsonContent;

    if (dockerBakeContent) {
      result.hasDockerBake = true;
      result.bakeTargets = parseDockerBakeTargets(dockerBakeContent);
    }

    if (result.monorepoType === 'turborepo') {
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
            build: dockerBakeContent
              ? {
                  strategy: 'bake',
                  definition: dockerBakeHclContent ? 'docker-bake.hcl' : 'docker-bake.json',
                  context: '.',
                  ...(result.bakeTargets.includes(app.name) ? { target: app.name } : {}),
                }
              : undefined,
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
