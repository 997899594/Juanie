import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getProjectAccessOrThrow,
  getProjectEnvironmentOrThrow,
  getProjectServiceOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { projects, releases } from '@/lib/db/schema';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { getProjectSourceRef } from '@/lib/projects/refs';
import { createProjectRelease, type ReleaseServiceInput } from '@/lib/releases';
import { ReleaseAdmissionError } from '@/lib/releases/admission';
import { buildProjectReleasePlan } from '@/lib/releases/planning';

const releaseServiceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).optional(),
  image: z.string().trim().min(1),
  digest: z.string().trim().min(1).nullable().optional(),
});

const createReleaseSchema = z.object({
  environmentId: z.string().uuid(),
  commitSha: z.string().trim().min(1).nullable().optional(),
  commitMessage: z.string().trim().max(2000).nullable().optional(),
  ref: z.string().trim().min(1).optional(),
  serviceId: z.string().uuid().optional(),
  serviceName: z.string().trim().min(1).optional(),
  image: z.string().trim().min(1).optional(),
  services: z.array(releaseServiceSchema).optional(),
  sourceReleaseId: z.string().uuid().nullable().optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { project, member } = await getProjectAccessOrThrow(id, session.user.id);
    const parsed = createReleaseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid release request' }, { status: 400 });
    }
    const input = parsed.data;
    const environment = await getProjectEnvironmentOrThrow(id, input.environmentId);
    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    const requestedServices: ReleaseServiceInput[] =
      input.services && input.services.length > 0
        ? input.services
        : input.image
          ? [{ id: input.serviceId, name: input.serviceName, image: input.image }]
          : [];
    if (requestedServices.length === 0) {
      return NextResponse.json(
        { error: 'At least one release service is required' },
        { status: 400 }
      );
    }
    const requestedServiceIds = [
      ...new Set(
        requestedServices
          .map((service) => service.id)
          .filter((serviceId): serviceId is string => Boolean(serviceId))
      ),
    ];
    await Promise.all(
      requestedServiceIds.map((serviceId) => getProjectServiceOrThrow(id, serviceId))
    );

    if (input.sourceReleaseId) {
      const sourceRelease = await db.query.releases.findFirst({
        where: eq(releases.id, input.sourceReleaseId),
        columns: { projectId: true },
      });
      if (!sourceRelease || sourceRelease.projectId !== id) {
        return NextResponse.json({ error: '来源发布不属于当前项目' }, { status: 400 });
      }
    }

    const sourceRef = input.ref ?? getProjectSourceRef({ branch: environment.branch, ...project });
    if (input.dryRun) {
      const plan = await buildProjectReleasePlan({
        projectId: id,
        environmentId: input.environmentId,
        services: requestedServices,
        sourceRef,
        sourceCommitSha: input.commitSha ?? null,
        entryPoint: 'manual_release',
        requestSchemaRefresh: true,
      });
      return NextResponse.json({ plan });
    }

    const projectWithRepository = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: { repository: true },
    });
    const release = await createProjectRelease({
      projectId: id,
      environmentId: input.environmentId,
      services: requestedServices,
      sourceRepository: projectWithRepository?.repository?.fullName ?? project.name,
      sourceRef,
      sourceCommitSha: input.commitSha ?? null,
      configCommitSha: input.commitSha ?? null,
      sourceReleaseId: input.sourceReleaseId ?? null,
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      summary: input.commitMessage ?? null,
      entryPoint: 'manual_release',
    });
    return NextResponse.json(release, { status: 202 });
  } catch (error) {
    if (isAccessError(error)) return toAccessErrorResponse(error);
    if (error instanceof ReleaseAdmissionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
