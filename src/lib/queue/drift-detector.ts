import { Cron } from 'croner';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { getK8sClient } from '@/lib/k8s';
import { AppBuilder } from '@/lib/k8s/app-builder';
import { AppDeployer } from '@/lib/k8s/app-deployer';
import { buildProjectNamespaceBase, buildProjectScopedK8sName } from '@/lib/k8s/naming';
import type { AppSpec } from '@/lib/k8s/types';

let driftDetectorRunning = false;

/**
 * 启动漂移检测 Worker
 * 每 5 分钟检查一次，发现漂移自动修复
 */
export function startDriftDetector(): void {
  if (driftDetectorRunning) {
    console.log('[DriftDetector] Already running');
    return;
  }

  driftDetectorRunning = true;

  // 每 5 分钟执行一次
  new Cron('*/5 * * * *', async () => {
    console.log('[DriftDetector] Starting drift detection...');
    await detectAndHeal();
  });

  console.log('[DriftDetector] Started (runs every 5 minutes)');
}

/**
 * 检测并修复漂移
 */
async function detectAndHeal(): Promise<void> {
  try {
    // 获取所有活跃项目
    const activeProjects = await db.query.projects.findMany({
      where: eq(projects.status, 'active'),
      with: {
        services: true,
        environments: true,
      },
    });

    for (const project of activeProjects) {
      try {
        await checkProjectDrift(project);
      } catch (error) {
        console.error(`[DriftDetector] Error checking project ${project.name}:`, error);
      }
    }
  } catch (error) {
    console.error('[DriftDetector] Error:', error);
  }
}

async function checkProjectDrift(project: any): Promise<void> {
  const namespace = buildProjectNamespaceBase(project.slug);

  for (const service of project.services || []) {
    const spec = await buildAppSpec(project, service);
    if (!spec) continue;

    const expected = AppBuilder.build(spec);
    const actual = await getActualResources(namespace, spec.name);

    if (hasDrift(expected, actual)) {
      console.log(`[DriftDetector] Drift detected for ${spec.name}, healing...`);
      await AppDeployer.deploy(spec);
      console.log(`[DriftDetector] Healed ${spec.name}`);
    }
  }
}

function hasDrift(expected: any, actual: any): boolean {
  if (!actual.deployment) return true;

  // 检查 replicas
  const expectedReplicas = expected.deployment.spec?.replicas;
  const actualReplicas = actual.deployment?.spec?.replicas;
  if (expectedReplicas !== actualReplicas) {
    console.log(
      `[DriftDetector] Replicas drift: expected ${expectedReplicas}, actual ${actualReplicas}`
    );
    return true;
  }

  // 检查 image
  const expectedImage = expected.deployment.spec?.template?.spec?.containers?.[0]?.image;
  const actualImage = actual.deployment?.spec?.template?.spec?.containers?.[0]?.image;
  if (expectedImage !== actualImage) {
    console.log(`[DriftDetector] Image drift: expected ${expectedImage}, actual ${actualImage}`);
    return true;
  }

  return false;
}

async function getActualResources(namespace: string, appName: string): Promise<any> {
  const { apps } = getK8sClient();

  try {
    const deployment = await apps.readNamespacedDeployment({
      namespace,
      name: appName,
    });
    return { deployment };
  } catch (e: any) {
    if ((e.code ?? e.statusCode) === 404) {
      return {};
    }
    throw e;
  }
}

async function buildAppSpec(project: any, service: any): Promise<AppSpec | null> {
  const namespace = buildProjectNamespaceBase(project.slug);

  // 跳过没有镜像的服务
  if (!service.imageRepository) {
    return null;
  }

  return {
    projectId: project.id,
    name: buildProjectScopedK8sName(project.slug, service.slug || service.name),
    namespace,
    image: {
      repository: service.imageRepository,
      tag: service.imageTag || 'latest',
      pullPolicy: 'Always',
    },
    replicas: service.replicas || 1,
    port: service.port || 3000,
    hostname: service.hostname || undefined,
  };
}
