import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments, environments, projects, releases, services } from '@/lib/db/schema';
import { resolveMigrationSpecifications } from '@/lib/migrations';
import {
  type EnvironmentPolicySnapshot,
  evaluateEnvironmentPolicy,
  evaluateMigrationPolicy,
  evaluateReleasePolicy,
  type ReleasePolicySnapshot,
} from '@/lib/policies/delivery';
import type { ReleaseServiceInput } from '@/lib/releases';

interface PlanningServiceLike {
  id: string;
  name: string;
  image: string;
  digest?: string | null;
}

interface PlanningMigrationSpecLike {
  specification: {
    autoRun: boolean;
    phase: 'preDeploy' | 'postDeploy' | 'manual';
    compatibility?: string | null;
    approvalPolicy?: string | null;
  };
  environment: {
    isProduction?: boolean | null;
    isPreview?: boolean | null;
  };
}

export interface ReleasePlanningSnapshot {
  canCreate: boolean;
  blockingReason: string | null;
  services: PlanningServiceLike[];
  environmentPolicy: EnvironmentPolicySnapshot;
  releasePolicy: ReleasePolicySnapshot;
  migration: {
    preDeployCount: number;
    postDeployCount: number;
    warnings: string[];
    requiresApproval: boolean;
  };
  summary: string | null;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function resolvePlanningServices(
  projectId: string,
  projectServices: Array<typeof services.$inferSelect>,
  inputs: ReleaseServiceInput[]
): PlanningServiceLike[] {
  if (inputs.length === 0) {
    throw new Error('At least one release service artifact is required');
  }

  if (inputs.length === 1 && !inputs[0]?.id && !inputs[0]?.name && projectServices.length > 1) {
    throw new Error(
      'Multi-service projects must specify serviceId/serviceName or use services[] when creating a release'
    );
  }

  return inputs.map((input) => {
    let service =
      (input.id ? projectServices.find((candidate) => candidate.id === input.id) : undefined) ??
      (input.name ? projectServices.find((candidate) => candidate.name === input.name) : undefined);

    if (!service && projectServices.length === 1) {
      service = projectServices[0];
    }

    if (!service || service.projectId !== projectId) {
      throw new Error(
        `Unable to resolve service for release artifact ${input.name ?? input.id ?? input.image}`
      );
    }

    return {
      id: service.id,
      name: service.name,
      image: input.image,
      digest: input.digest ?? null,
    };
  });
}

export function summarizeReleasePlan(input: {
  environment: {
    isProduction?: boolean | null;
    isPreview?: boolean | null;
  };
  services: PlanningServiceLike[];
  migrationSpecs: PlanningMigrationSpecLike[];
}): ReleasePlanningSnapshot {
  const autoRunSpecs = input.migrationSpecs.filter((spec) => spec.specification.autoRun);
  const preDeploySpecs = autoRunSpecs.filter((spec) => spec.specification.phase === 'preDeploy');
  const postDeploySpecs = autoRunSpecs.filter((spec) => spec.specification.phase === 'postDeploy');
  const warnings = dedupe(
    autoRunSpecs.flatMap(
      (spec) =>
        evaluateMigrationPolicy({
          environment: spec.environment,
          specification: spec.specification,
        }).warnings
    )
  );
  const environmentPolicy = evaluateEnvironmentPolicy(input.environment);
  const releasePolicy = evaluateReleasePolicy({
    environment: input.environment,
    migrationRuns: autoRunSpecs.map((spec) => ({
      specification: spec.specification,
    })),
  });
  const totalAutoRun = preDeploySpecs.length + postDeploySpecs.length;

  return {
    canCreate: true,
    blockingReason: null,
    services: input.services,
    environmentPolicy,
    releasePolicy,
    migration: {
      preDeployCount: preDeploySpecs.length,
      postDeployCount: postDeploySpecs.length,
      warnings,
      requiresApproval: releasePolicy.requiresApproval,
    },
    summary:
      releasePolicy.summary ??
      environmentPolicy.summary ??
      (totalAutoRun > 0 ? `包含 ${totalAutoRun} 项自动迁移` : null),
  };
}

export async function buildProjectReleasePlan(input: {
  projectId: string;
  environmentId: string;
  services: ReleaseServiceInput[];
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}): Promise<ReleasePlanningSnapshot> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    with: {
      services: true,
    },
  });

  if (!project) {
    throw new Error(`Project ${input.projectId} not found`);
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, input.environmentId),
  });

  if (!environment || environment.projectId !== project.id) {
    throw new Error(`Environment ${input.environmentId} not found`);
  }

  const plannedServices = resolvePlanningServices(project.id, project.services, input.services);
  const serviceIds = plannedServices.map((service) => service.id);
  const [preDeploySpecs, postDeploySpecs] = await Promise.all([
    resolveMigrationSpecifications(project.id, environment.id, 'preDeploy', {
      serviceIds,
      sourceRef: input.sourceRef,
      sourceCommitSha: input.sourceCommitSha,
    }),
    resolveMigrationSpecifications(project.id, environment.id, 'postDeploy', {
      serviceIds,
      sourceRef: input.sourceRef,
      sourceCommitSha: input.sourceCommitSha,
    }),
  ]);

  return summarizeReleasePlan({
    environment,
    services: plannedServices,
    migrationSpecs: [...preDeploySpecs, ...postDeploySpecs],
  });
}

export async function buildPromotionPlan(projectId: string): Promise<{
  sourceRelease: {
    id: string;
    summary: string | null;
    sourceCommitSha: string | null;
  } | null;
  plan: ReleasePlanningSnapshot;
}> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: { repository: true },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const envList = await db.query.environments.findMany({
    where: eq(environments.projectId, projectId),
  });
  const stagingEnv = envList.find(
    (environment) => environment.autoDeploy && !environment.isProduction
  );
  const prodEnv = envList.find((environment) => environment.isProduction);

  if (!prodEnv) {
    return {
      sourceRelease: null,
      plan: {
        canCreate: false,
        blockingReason: 'No production environment found',
        services: [],
        environmentPolicy: evaluateEnvironmentPolicy({ isProduction: false }),
        releasePolicy: evaluateReleasePolicy({
          environment: { isProduction: false },
          migrationRuns: [],
        }),
        migration: {
          preDeployCount: 0,
          postDeployCount: 0,
          warnings: [],
          requiresApproval: false,
        },
        summary: null,
      },
    };
  }

  if (!stagingEnv) {
    return {
      sourceRelease: null,
      plan: {
        canCreate: false,
        blockingReason: 'No staging environment found',
        services: [],
        environmentPolicy: evaluateEnvironmentPolicy(prodEnv),
        releasePolicy: evaluateReleasePolicy({
          environment: prodEnv,
          migrationRuns: [],
        }),
        migration: {
          preDeployCount: 0,
          postDeployCount: 0,
          warnings: [],
          requiresApproval: false,
        },
        summary: evaluateEnvironmentPolicy(prodEnv).summary,
      },
    };
  }

  const sourceRelease = await db.query.releases.findFirst({
    where: and(
      eq(releases.projectId, projectId),
      eq(releases.environmentId, stagingEnv.id),
      eq(releases.status, 'succeeded')
    ),
    orderBy: [desc(releases.createdAt)],
    with: {
      artifacts: {
        with: {
          service: true,
        },
      },
    },
  });

  if (!sourceRelease || sourceRelease.artifacts.length === 0) {
    return {
      sourceRelease: null,
      plan: {
        canCreate: false,
        blockingReason: 'No successful staging release found to promote',
        services: [],
        environmentPolicy: evaluateEnvironmentPolicy(prodEnv),
        releasePolicy: evaluateReleasePolicy({
          environment: prodEnv,
          migrationRuns: [],
        }),
        migration: {
          preDeployCount: 0,
          postDeployCount: 0,
          warnings: [],
          requiresApproval: false,
        },
        summary: evaluateEnvironmentPolicy(prodEnv).summary,
      },
    };
  }

  const plan = await buildProjectReleasePlan({
    projectId,
    environmentId: prodEnv.id,
    services: sourceRelease.artifacts.map((artifact) => ({
      id: artifact.serviceId,
      name: artifact.service.name,
      image: artifact.imageUrl,
      digest: artifact.imageDigest,
    })),
    sourceRef: `refs/heads/${prodEnv.branch ?? project.productionBranch ?? 'main'}`,
    sourceCommitSha: sourceRelease.sourceCommitSha,
  });

  return {
    sourceRelease: {
      id: sourceRelease.id,
      summary: sourceRelease.summary,
      sourceCommitSha: sourceRelease.sourceCommitSha,
    },
    plan,
  };
}

export async function buildRollbackPlan(input: {
  projectId: string;
  deploymentId: string;
}): Promise<{
  sourceDeployment: {
    id: string;
    imageUrl: string;
    commitSha: string | null;
    environmentId: string;
    serviceId: string | null;
    branch: string | null;
  } | null;
  plan: ReleasePlanningSnapshot;
}> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    with: { repository: true },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const targetDeployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, input.deploymentId),
  });

  if (!targetDeployment || targetDeployment.projectId !== input.projectId) {
    return {
      sourceDeployment: null,
      plan: {
        canCreate: false,
        blockingReason: 'Deployment not found',
        services: [],
        environmentPolicy: evaluateEnvironmentPolicy({ isProduction: false }),
        releasePolicy: evaluateReleasePolicy({
          environment: { isProduction: false },
          migrationRuns: [],
        }),
        migration: {
          preDeployCount: 0,
          postDeployCount: 0,
          warnings: [],
          requiresApproval: false,
        },
        summary: null,
      },
    };
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, targetDeployment.environmentId),
  });

  if (!environment || environment.projectId !== input.projectId) {
    return {
      sourceDeployment: null,
      plan: {
        canCreate: false,
        blockingReason: 'Environment not found',
        services: [],
        environmentPolicy: evaluateEnvironmentPolicy({ isProduction: false }),
        releasePolicy: evaluateReleasePolicy({
          environment: { isProduction: false },
          migrationRuns: [],
        }),
        migration: {
          preDeployCount: 0,
          postDeployCount: 0,
          warnings: [],
          requiresApproval: false,
        },
        summary: null,
      },
    };
  }

  if (!targetDeployment.imageUrl) {
    return {
      sourceDeployment: null,
      plan: {
        canCreate: false,
        blockingReason: 'Deployment has no image URL — cannot roll back to this version',
        services: [],
        environmentPolicy: evaluateEnvironmentPolicy(environment),
        releasePolicy: evaluateReleasePolicy({
          environment,
          migrationRuns: [],
        }),
        migration: {
          preDeployCount: 0,
          postDeployCount: 0,
          warnings: [],
          requiresApproval: false,
        },
        summary: evaluateEnvironmentPolicy(environment).summary,
      },
    };
  }

  const plan = await buildProjectReleasePlan({
    projectId: input.projectId,
    environmentId: targetDeployment.environmentId,
    services: [
      {
        id: targetDeployment.serviceId ?? undefined,
        image: targetDeployment.imageUrl,
      },
    ],
    sourceRef: targetDeployment.branch
      ? `refs/heads/${targetDeployment.branch}`
      : `refs/heads/${project.productionBranch ?? 'main'}`,
    sourceCommitSha: targetDeployment.commitSha ?? null,
  });

  return {
    sourceDeployment: {
      id: targetDeployment.id,
      imageUrl: targetDeployment.imageUrl,
      commitSha: targetDeployment.commitSha ?? null,
      environmentId: targetDeployment.environmentId,
      serviceId: targetDeployment.serviceId ?? null,
      branch: targetDeployment.branch ?? null,
    },
    plan,
  };
}
