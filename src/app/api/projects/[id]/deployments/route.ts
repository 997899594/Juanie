import { desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { deployments, environments, migrationRuns, services } from '@/lib/db/schema';
import { canReadProjectRuntime } from '@/lib/policies/runtime-access';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(id, session.user.id);

    if (!canReadProjectRuntime(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
