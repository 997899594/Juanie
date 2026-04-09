import { desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectEnvironmentOrThrow,
  getProjectServiceOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { deployments, environments, migrationRuns, projects, services } from '@/lib/db/schema';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { createProjectRelease } from '@/lib/releases';
import { buildProjectReleasePlan } from '@/lib/releases/planning';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    await getProjectAccessOrThrow(id, session.user.id);

    const url = new URL(request.url);
    const envFilter = url.searchParams.get('env');

    const result = await db
      .select({
        deployment: deployments,
        environmentName: environments.name,
        environmentNamespace: environments.namespace,
        serviceName: services.name,
      })
      .from(deployments)
      .innerJoin(environments, eq(environments.id, deployments.environmentId))
      .leftJoin(services, eq(services.id, deployments.serviceId))
      .where(eq(deployments.projectId, id))
      .orderBy(desc(deployments.createdAt));

    const deploymentIds = result.map((row) => row.deployment.id);
    const runRows =
      deploymentIds.length > 0
        ? await db.query.migrationRuns.findMany({
            where: inArray(migrationRuns.deploymentId, deploymentIds),
            orderBy: (run, { desc }) => [desc(run.createdAt)],
          })
        : [];

    const migrationSummaryByDeployment = new Map<
      string,
      {
        count: number;
        latestStatus: string;
        latestRunId: string;
      }
    >();

    for (const run of runRows) {
      if (!run.deploymentId) continue;
      const existing = migrationSummaryByDeployment.get(run.deploymentId);
      if (!existing) {
        migrationSummaryByDeployment.set(run.deploymentId, {
          count: 1,
          latestStatus: run.status,
          latestRunId: run.id,
        });
        continue;
      }
      migrationSummaryByDeployment.set(run.deploymentId, {
        ...existing,
        count: existing.count + 1,
      });
    }

    const enriched = result.map((row) => ({
      ...row,
      migrationSummary: migrationSummaryByDeployment.get(row.deployment.id) ?? null,
    }));

    const filtered = envFilter ? enriched.filter((r) => r.environmentName === envFilter) : enriched;

    return NextResponse.json(filtered);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { project, member } = await getProjectAccessOrThrow(id, session.user.id);
    const projectWithRepository = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        repository: true,
      },
    });

    const {
      environmentId,
      commitSha,
      commitMessage,
      ref,
      serviceId,
      serviceName,
      image,
      services: releaseServices,
      dryRun,
    } = await request.json();

    if (!environmentId) {
      return NextResponse.json({ error: 'Environment ID is required' }, { status: 400 });
    }

    const environment = await getProjectEnvironmentOrThrow(id, environmentId);
    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    if (serviceId) {
      await getProjectServiceOrThrow(id, serviceId);
    }

    const requestedServices =
      Array.isArray(releaseServices) && releaseServices.length > 0
        ? releaseServices
        : image
          ? [
              {
                id: serviceId,
                name: serviceName,
                image,
              },
            ]
          : [];

    const requestedServiceIds = Array.from(
      new Set(
        requestedServices
          .map((candidate) => candidate?.id)
          .filter((candidate): candidate is string => Boolean(candidate))
      )
    );

    await Promise.all(
      requestedServiceIds.map((candidateId) => getProjectServiceOrThrow(id, candidateId))
    );

    if (requestedServices.length === 0) {
      return NextResponse.json(
        { error: 'Releases require image metadata. Provide image or services[]' },
        { status: 400 }
      );
    }

    if (dryRun) {
      const plan = await buildProjectReleasePlan({
        projectId: id,
        environmentId,
        services: requestedServices,
        sourceRef: ref ?? `refs/heads/${environment.branch ?? project.productionBranch ?? 'main'}`,
        sourceCommitSha: commitSha ?? null,
      });

      return NextResponse.json({ plan });
    }

    const release = await createProjectRelease({
      projectId: id,
      environmentId,
      services: requestedServices,
      sourceRepository: projectWithRepository?.repository?.fullName ?? project.name,
      sourceRef: ref ?? `refs/heads/${environment.branch ?? project.productionBranch ?? 'main'}`,
      sourceCommitSha: commitSha ?? null,
      configCommitSha: commitSha ?? null,
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      summary: commitMessage ?? null,
    });

    return NextResponse.json(release, { status: 202 });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
