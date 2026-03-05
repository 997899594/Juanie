import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { gitProviders, repositories } from '@/lib/db/schema';
import { createGitProvider } from '@/lib/git';
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

/**
 * 解析 docker-bake.hcl 文件，提取 target 列表
 */
function parseDockerBakeTargets(content: string): string[] {
  const targets: string[] = [];
  // 匹配 target "name" { ... } 格式
  const targetRegex = /target\s+["']?(\w+)["']?\s*\{/g;
  let match: RegExpExecArray | null = targetRegex.exec(content);

  while (match !== null) {
    const targetName = match[1];
    // 排除 default 和 multi 这些特殊 target
    if (targetName && !['default', 'multi'].includes(targetName)) {
      targets.push(targetName);
    }
    match = targetRegex.exec(content);
  }

  return [...new Set(targets)]; // 去重
}

/**
 * 从 package.json 解析启动命令
 */
function parseStartCommand(
  content: string,
  _serviceName: string
): { startCommand: string; port: number } {
  try {
    const pkg = JSON.parse(content);
    // 优先使用 start 脚本
    if (pkg.scripts?.start) {
      return { startCommand: pkg.scripts.start, port: 3000 };
    }
    // 其次使用 dev（生产环境可能需要调整）
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
  const branch = searchParams.get('branch') || 'main';

  if (!repositoryId) {
    return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
  }

  // 获取仓库信息
  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, repositoryId),
  });

  if (!repository) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  // 获取 Git Provider
  const provider = await db.query.gitProviders.findFirst({
    where: eq(gitProviders.id, repository.providerId),
  });

  if (!provider || !provider.accessToken) {
    return NextResponse.json({ error: 'Git provider not found' }, { status: 404 });
  }

  if (provider.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const gitProvider = createGitProvider({
      type: provider.type,
      serverUrl: provider.serverUrl || undefined,
      clientId: provider.clientId || '',
      clientSecret: provider.clientSecret || '',
      redirectUri: '',
    });

    const result: AnalyzeResult = {
      monorepoType: 'none',
      hasDockerBake: false,
      bakeTargets: [],
      services: [],
    };

    // 1. 检测 monorepo 类型
    const rootFiles = await gitProvider.listRootFiles(
      provider.accessToken,
      repository.fullName,
      branch
    );
    result.monorepoType = detectMonorepoType(rootFiles);

    // 2. 检测 docker-bake.hcl
    const dockerBakeContent = await gitProvider.getFileContent(
      provider.accessToken,
      repository.fullName,
      'docker-bake.hcl',
      branch
    );

    if (dockerBakeContent) {
      result.hasDockerBake = true;
      result.bakeTargets = parseDockerBakeTargets(dockerBakeContent);
    }

    // 3. 自动发现服务
    if (result.monorepoType !== 'none') {
      // Monorepo: 扫描 apps/ 目录
      const appsDir = await gitProvider.listDirectory(
        provider.accessToken,
        repository.fullName,
        'apps',
        branch
      );

      for (const app of appsDir) {
        if (app.type === 'dir') {
          // 读取 package.json 获取启动命令
          const pkgContent = await gitProvider.getFileContent(
            provider.accessToken,
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
      // 非 monorepo 但有 docker-bake.hcl: 使用 targets 作为服务
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
      // 单服务项目
      const pkgContent = await gitProvider.getFileContent(
        provider.accessToken,
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
    console.error('Failed to analyze repository:', error);
    return NextResponse.json({ error: 'Failed to analyze repository' }, { status: 500 });
  }
}
