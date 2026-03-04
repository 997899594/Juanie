import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deployments, repositories, services, webhooks } from '@/lib/db/schema';
import { addDeploymentJob } from '@/lib/queue';
import {
  buildImageName,
  getAffectedServiceNames,
  isMonorepo,
  type ServiceWithMonorepo,
} from '@/lib/monorepo';

/**
 * Git Webhook 接收端点
 *
 * 支持 GitHub 和 GitLab 的 push 事件
 *
 * GitHub 签名验证：X-Hub-Signature-256 (HMAC-SHA256)
 * GitLab 签名验证：X-Gitlab-Token (直接比对)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // 获取 headers
    const githubSignature = request.headers.get('x-hub-signature-256');
    const gitlabToken = request.headers.get('x-gitlab-token');
    const githubEvent = request.headers.get('x-github-event');
    const gitlabEvent = request.headers.get('x-gitlab-event');

    // 解析 body
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 判断来源并提取信息
    let repoFullName: string | undefined;
    let branch: string | undefined;
    let commitSha: string | undefined;
    let commitMessage: string | undefined;
    let _pusher: string | undefined;
    let isGitHub = false;
    let isGitLab = false;

    if (githubEvent) {
      isGitHub = true;
      // GitHub 格式
      const repo = payload.repository as Record<string, unknown> | undefined;
      repoFullName = repo?.full_name as string | undefined;
      branch = (payload.ref as string)?.replace('refs/heads/', '');
      const headCommit = payload.head_commit as Record<string, unknown> | undefined;
      commitSha = headCommit?.id as string | undefined;
      commitMessage = headCommit?.message as string | undefined;
      const pusherInfo = payload.pusher as Record<string, unknown> | undefined;
      _pusher = pusherInfo?.name as string | undefined;

      // 只处理 push 事件
      if (githubEvent !== 'push') {
        return NextResponse.json({ message: `Ignored event: ${githubEvent}` });
      }
    } else if (gitlabToken || gitlabEvent) {
      isGitLab = true;
      // GitLab 格式
      const repo = payload.project as Record<string, unknown> | undefined;
      repoFullName = repo?.path_with_namespace as string | undefined;
      branch = (payload.ref as string)?.replace('refs/heads/', '');
      const commits = payload.commits as Array<Record<string, unknown>> | undefined;
      const lastCommit = commits?.[commits.length - 1];
      commitSha = lastCommit?.id as string | undefined;
      commitMessage = lastCommit?.message as string | undefined;
      const userEmail = lastCommit?.author as Record<string, unknown> | undefined;
      _pusher = userEmail?.email as string | undefined;

      // 只处理 push 事件
      if (gitlabEvent && gitlabEvent !== 'Push Hook') {
        return NextResponse.json({ message: `Ignored event: ${gitlabEvent}` });
      }
    } else {
      return NextResponse.json({ error: 'Unknown webhook source' }, { status: 400 });
    }

    if (!repoFullName) {
      return NextResponse.json({ error: 'Repository not found in payload' }, { status: 400 });
    }

    // 查找对应的仓库和项目
    const repository = await db.query.repositories.findFirst({
      where: eq(repositories.fullName, repoFullName),
      with: {
        projects: {
          with: {
            webhooks: true,
            environments: true,
          },
        },
      },
    });

    if (!repository || repository.projects.length === 0) {
      return NextResponse.json({ error: 'No project found for this repository' }, { status: 404 });
    }

    // 找到启用了 autoDeploy 的项目
    const project = repository.projects.find((p) => p.autoDeploy);
    if (!project) {
      return NextResponse.json({ message: 'Auto deploy disabled for this project' });
    }

    // 验证 webhook 签名
    const webhook = project.webhooks.find((w) => w.active);
    if (!webhook || !webhook.secret) {
      return NextResponse.json({ error: 'No active webhook configured' }, { status: 400 });
    }

    if (isGitHub && githubSignature) {
      // GitHub HMAC-SHA256 验证
      const isValid = await verifyGitHubSignature(body, webhook.secret, githubSignature);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (isGitLab && gitlabToken) {
      // GitLab token 直接比对
      if (gitlabToken !== webhook.secret) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    // 更新 webhook 最后触发时间
    await db
      .update(webhooks)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(webhooks.id, webhook.id));

    // 检查分支是否匹配生产分支
    if (branch && project.productionBranch && branch !== project.productionBranch) {
      return NextResponse.json({
        message: `Branch ${branch} does not match production branch ${project.productionBranch}`,
      });
    }

    // 找到生产环境
    const productionEnv = project.environments.find((e) => e.name === 'production');
    if (!productionEnv) {
      return NextResponse.json({ error: 'Production environment not found' }, { status: 400 });
    }

    // 检查是否为 monorepo 项目
    const projectConfig = project.configJson as {
      monorepo?: { enabled?: boolean };
    } | null;
    const monorepoConfig = projectConfig?.monorepo;

    if (isMonorepo(monorepoConfig)) {
      // Monorepo 流程：为每个受影响的服务创建部署
      return handleMonorepoPush(payload, project, productionEnv, commitSha, commitMessage, branch);
    }

    // 单服务流程
    // 创建部署记录
    const [deployment] = await db
      .insert(deployments)
      .values({
        projectId: project.id,
        environmentId: productionEnv.id,
        status: 'queued',
        commitSha: commitSha || undefined,
        commitMessage: commitMessage || undefined,
        branch: branch || undefined,
      })
      .returning();

    // 添加到部署队列
    await addDeploymentJob(deployment.id, project.id, productionEnv.id);

    console.log(`✅ Triggered deployment for ${project.name} (commit: ${commitSha?.slice(0, 7)})`);

    return NextResponse.json({
      message: 'Deployment triggered',
      deploymentId: deployment.id,
      project: project.name,
      commit: commitSha?.slice(0, 7),
      branch,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle monorepo push event - creates deployment for each affected service
 */
async function handleMonorepoPush(
  payload: Record<string, unknown>,
  project: {
    id: string;
    name: string;
    repositoryId?: string | null;
    configJson?: unknown;
  },
  productionEnv: { id: string },
  commitSha?: string,
  commitMessage?: string,
  branch?: string
): Promise<NextResponse> {
  // 1. 获取项目所有服务
  const projectServices = await db.query.services.findMany({
    where: eq(services.projectId, project.id),
  });

  if (projectServices.length === 0) {
    return NextResponse.json({ message: 'No services found for this monorepo project' });
  }

  // 2. 获取变更文件列表
  const changedFiles = extractChangedFiles(payload);

  if (changedFiles.length === 0) {
    return NextResponse.json({ message: 'No file changes detected in push event' });
  }

  // 3. 将服务转换为 monorepo 格式
  const servicesWithMonorepo: ServiceWithMonorepo[] = projectServices.map((service) => {
    // 从 project.configJson.services 获取服务级别的 monorepo 配置
    const projectConfig = project.configJson as {
      services?: Record<string, { monorepo?: { appDir?: string } }>;
    } | null;
    const serviceConfig = projectConfig?.services?.[service.name];

    return {
      id: service.id,
      name: service.name,
      projectId: service.projectId,
      type: service.type,
      monorepoConfig: serviceConfig?.monorepo,
    };
  });

  // 4. 计算受影响的服务
  const affectedServiceNames = getAffectedServiceNames(changedFiles, servicesWithMonorepo);

  if (affectedServiceNames.length === 0) {
    return NextResponse.json({
      message: 'No services affected by the changes',
      changedFiles: changedFiles.length,
    });
  }

  // 5. 为每个受影响服务创建部署任务
  const deploymentResults: Array<{ serviceName: string; deploymentId: string }> = [];

  for (const serviceName of affectedServiceNames) {
    const service = projectServices.find((s) => s.name === serviceName);
    if (!service) continue;

    // 创建部署记录
    const [deployment] = await db
      .insert(deployments)
      .values({
        projectId: project.id,
        serviceId: service.id,
        environmentId: productionEnv.id,
        status: 'queued',
        commitSha: commitSha || undefined,
        commitMessage: commitMessage || undefined,
        branch: branch || undefined,
      })
      .returning();

    // 添加到部署队列
    await addDeploymentJob(deployment.id, project.id, productionEnv.id);

    deploymentResults.push({
      serviceName: service.name,
      deploymentId: deployment.id,
    });

    console.log(
      `✅ Triggered monorepo deployment for ${project.name}/${service.name} (commit: ${commitSha?.slice(0, 7)})`
    );
  }

  return NextResponse.json({
    message: 'Monorepo deployments triggered',
    project: project.name,
    commit: commitSha?.slice(0, 7),
    branch,
    affectedServices: affectedServiceNames,
    deployments: deploymentResults,
    changedFilesCount: changedFiles.length,
  });
}

/**
 * Extract changed files from push payload (supports GitHub and GitLab)
 */
function extractChangedFiles(payload: Record<string, unknown>): string[] {
  const files = new Set<string>();

  // Handle commits array (both GitHub and GitLab have this)
  const commits = payload.commits as Array<Record<string, unknown>> | undefined;

  if (commits) {
    for (const commit of commits) {
      // Added files
      for (const file of (commit.added as string[]) || []) {
        files.add(file);
      }
      // Modified files
      for (const file of (commit.modified as string[]) || []) {
        files.add(file);
      }
      // Removed files
      for (const file of (commit.removed as string[]) || []) {
        files.add(file);
      }
    }
  }

  return Array.from(files);
}

/**
 * 验证 GitHub webhook 签名
 */
async function verifyGitHubSignature(
  payload: string,
  secret: string,
  signature: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedSignature = `sha256=${bufferToHex(signatureBuffer)}`;

  // 使用时序安全比较
  return timingSafeEqual(expectedSignature, signature);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
