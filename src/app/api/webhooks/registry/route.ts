import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deployments, projects, services, webhooks } from '@/lib/db/schema';
import { addDeploymentJob } from '@/lib/queue';

/**
 * Registry Webhook 接收端点
 *
 * 当用户的 CI 构建完成并推送镜像后，镜像仓库（GHCR/GitLab Registry）会调用这个 webhook，
 * Juanie 接收后验证并触发部署。
 *
 * 支持的镜像仓库:
 * - GitHub Container Registry (GHCR)
 * - GitLab Container Registry
 *
 * 签名验证：
 * - GitHub: X-Hub-Signature-256 (HMAC-SHA256)
 * - GitLab: X-Gitlab-Token (直接比对)
 *
 * URL 格式: /api/webhooks/registry?project_id={uuid}
 */
export async function POST(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing project_id' }, { status: 400 });
    }

    // 获取请求体
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

    // 1. 获取项目的 webhook 配置
    const webhook = await db.query.webhooks.findFirst({
      where: eq(webhooks.projectId, projectId),
    });

    if (!webhook || !webhook.secret) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 404 });
    }

    // 2. 验证签名
    let isGitHub = false;
    let isGitLab = false;

    if (githubEvent || githubSignature) {
      isGitHub = true;
      // GitHub HMAC-SHA256 验证
      const isValid = await verifyGitHubSignature(body, webhook.secret, githubSignature);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (gitlabToken || gitlabEvent) {
      isGitLab = true;
      // GitLab token 直接比对
      if (gitlabToken !== webhook.secret) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'Unknown webhook source' }, { status: 400 });
    }

    // 3. 解析镜像信息
    const imageInfo = extractImageInfo(payload, isGitHub, isGitLab);

    if (!imageInfo) {
      return NextResponse.json({ error: 'Could not extract image info' }, { status: 400 });
    }

    const { imageName, tag } = imageInfo;

    // 3.5 解析多服务镜像名
    const parsedImage = parseMultiServiceImageName(`${imageName}:${tag}`);
    console.log(`Parsed image: ${JSON.stringify(parsedImage)}`);

    // 4. 获取项目信息并验证镜像名匹配
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        environments: true,
        services: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 验证镜像名是否匹配项目配置
    if (!imageMatchesProject(imageName, project)) {
      return NextResponse.json({ error: 'Image mismatch' }, { status: 403 });
    }

    // 4.5 根据服务名匹配具体服务（多服务模式）
    let targetService: typeof services.$inferSelect | null = null;
    if (parsedImage.service) {
      // 多服务模式：通过服务名匹配
      targetService =
        project.services.find((s) => s.name.toLowerCase() === parsedImage.service?.toLowerCase()) ||
        null;

      if (!targetService) {
        console.warn(
          `Service "${parsedImage.service}" not found in project ${project.name}. Available services: ${project.services.map((s) => s.name).join(', ')}`
        );
        return NextResponse.json(
          { error: `Service "${parsedImage.service}" not found` },
          { status: 404 }
        );
      }
      console.log(`Matched service: ${targetService.name} (type: ${targetService.type})`);
    }

    // 5. 更新 webhook 最后触发时间
    await db
      .update(webhooks)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(webhooks.id, webhook.id));

    // 6. 找到生产环境
    const productionEnv = project.environments.find((e) => e.name === 'production');
    if (!productionEnv) {
      return NextResponse.json({ error: 'Production environment not found' }, { status: 400 });
    }

    // 7. 创建部署记录
    const [deployment] = await db
      .insert(deployments)
      .values({
        projectId: project.id,
        environmentId: productionEnv.id,
        serviceId: targetService?.id || null,
        status: 'queued',
        imageUrl: imageName,
        // 从 tag 中提取 commit sha (格式: sha-abc1234 或直接使用 tag)
        commitSha: extractCommitShaFromTag(tag),
      })
      .returning();

    // 8. 触发部署任务
    await addDeploymentJob(deployment.id, project.id, productionEnv.id);

    const logMessage = targetService
      ? `Webhook triggered deployment for ${project.name}/${targetService.name} (image: ${imageName})`
      : `Webhook triggered deployment for ${project.name} (image: ${imageName})`;
    console.log(logMessage);

    return NextResponse.json({
      success: true,
      deploymentId: deployment.id,
      project: project.name,
      service: targetService?.name || null,
      image: imageName,
    });
  } catch (error) {
    console.error('Registry webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 从 webhook payload 中提取镜像信息
 *
 * GitHub Package webhook payload 结构:
 * {
 *   "package": {
 *     "package_version": {
 *       "package_url": "ghcr.io/owner/repo/image:tag",
 *       "version": "tag"
 *     }
 *   }
 * }
 *
 * GitLab Registry webhook payload 结构:
 * {
 *   "repository": {
 *     "location": "registry.gitlab.com/owner/repo/image:tag"
 *   },
 *   "tag": "tag"
 * }
 */
function extractImageInfo(
  payload: Record<string, unknown>,
  isGitHub: boolean,
  isGitLab: boolean
): { imageName: string; tag: string } | null {
  if (isGitHub) {
    // GitHub Package webhook format
    const pkg = payload.package as Record<string, unknown> | undefined;
    const packageVersion = pkg?.package_version as Record<string, unknown> | undefined;
    const packageUrl = packageVersion?.package_url as string | undefined;
    const version = packageVersion?.version as string | undefined;

    if (packageUrl) {
      // package_url 格式: ghcr.io/owner/repo/image:tag
      const colonIndex = packageUrl.lastIndexOf(':');
      if (colonIndex > 0) {
        return {
          imageName: packageUrl.substring(0, colonIndex),
          tag: packageUrl.substring(colonIndex + 1),
        };
      }
      return {
        imageName: packageUrl,
        tag: version || 'latest',
      };
    }
  }

  if (isGitLab) {
    // GitLab registry webhook format
    const repository = payload.repository as Record<string, unknown> | undefined;
    const location = repository?.location as string | undefined;
    const tag = (payload.tag as string) || 'latest';

    if (location) {
      // location 可能已包含 tag，也可能不包含
      const colonIndex = location.lastIndexOf(':');
      if (colonIndex > 0 && !location.includes('/', colonIndex)) {
        // location 已包含 tag
        return {
          imageName: location.substring(0, colonIndex),
          tag: location.substring(colonIndex + 1),
        };
      }
      // location 不包含 tag，使用 payload.tag
      return {
        imageName: location,
        tag,
      };
    }
  }

  return null;
}

/**
 * 验证镜像名是否匹配项目配置
 *
 * 项目配置中的 imageName 应该是镜像的基础路径（不包含 tag）
 * 例如: ghcr.io/owner/repo 或 registry.gitlab.com/owner/repo
 */
function imageMatchesProject(imageName: string, project: typeof projects.$inferSelect): boolean {
  const config = project.configJson as Record<string, unknown> | null;
  if (!config?.imageName) {
    // 如果没有配置 imageName，允许任何镜像（向后兼容）
    return true;
  }

  const configuredImage = config.imageName as string;

  // 镜像名前缀匹配（忽略 tag，不区分大小写，因为 registry 通常是小写）
  const normalizedImageName = imageName.toLowerCase();
  const normalizedConfiguredImage = configuredImage.toLowerCase();

  return (
    normalizedImageName === normalizedConfiguredImage ||
    normalizedImageName.startsWith(`${normalizedConfiguredImage}:`) ||
    normalizedImageName.startsWith(`${normalizedConfiguredImage}/`)
  );
}

/**
 * 从 tag 中提取 commit sha
 * 支持格式: sha-abc1234 或直接使用整个 tag
 */
function extractCommitShaFromTag(tag: string): string | undefined {
  if (!tag) return undefined;

  // 尝试匹配 sha-xxx 格式
  const shaMatch = tag.match(/^sha-([a-f0-9]+)$/i);
  if (shaMatch) {
    return shaMatch[1];
  }

  // 如果 tag 本身是 commit sha (7位或更长)
  if (/^[a-f0-9]{7,}$/i.test(tag)) {
    return tag;
  }

  // 其他情况不返回 commit sha
  return undefined;
}

/**
 * 解析多服务镜像名
 *
 * 支持两种格式:
 * 1. 多服务格式: {registry}/{owner}/{repo}/{service}:sha-{commit}
 *    例如: ghcr.io/owner/repo/web:sha-abc1234
 * 2. 单服务格式: {registry}/{owner}/{repo}:sha-{commit}
 *    例如: ghcr.io/owner/repo:sha-abc1234
 *
 * 返回值:
 * - name: 完整镜像名（不含 tag）
 * - tag: 镜像 tag
 * - service: 服务名（多服务格式）或 null（单服务格式）
 * - projectName: 项目镜像名前缀（不含服务名）
 */
function parseMultiServiceImageName(fullName: string): {
  name: string;
  tag: string;
  service: string | null;
  projectName: string;
} {
  const [name, tag] = fullName.split(':');

  const parts = name.split('/');

  // 标准格式: {registry}/{owner}/{repo}/{service}:sha-{commit}
  // 4+ 部分表示多服务镜像
  if (parts.length >= 4) {
    const service = parts[parts.length - 1];
    const projectName = parts.slice(0, -1).join('/');

    return {
      name: fullName,
      tag: tag || 'latest',
      service,
      projectName,
    };
  }

  // 单服务格式: {registry}/{owner}/{repo}:sha-{commit}
  return {
    name: fullName,
    tag: tag || 'latest',
    service: null,
    projectName: name,
  };
}

/**
 * 验证 GitHub webhook 签名
 */
async function verifyGitHubSignature(
  payload: string,
  secret: string,
  signature: string | null
): Promise<boolean> {
  if (!signature) return false;

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
