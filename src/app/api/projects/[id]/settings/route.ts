import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectAccessWithRoleOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { environments, projects, teams } from '@/lib/db/schema';
import { deleteNamespace, getIsConnected, initK8sClient } from '@/lib/k8s';
import { buildProjectGovernanceSnapshot } from '@/lib/projects/settings-view';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();

    const { project, member } = await getProjectAccessOrThrow(id, session.user.id);
    const [projectWithRepository, team, environmentList] = await Promise.all([
      db.query.projects.findFirst({
        where: eq(projects.id, id),
        with: {
          repository: true,
        },
      }),
      db.query.teams.findFirst({
        where: eq(teams.id, project.teamId),
      }),
      db.query.environments.findMany({
        where: eq(environments.projectId, id),
      }),
    ]);

    if (!projectWithRepository) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...projectWithRepository,
      repositoryFullName: projectWithRepository.repository?.fullName ?? null,
      repositoryWebUrl: projectWithRepository.repository?.webUrl ?? null,
      teamName: team?.name,
      teamSlug: team?.slug,
      yourRole: member.role,
      governance: buildProjectGovernanceSnapshot({
        role: member.role,
        environments: environmentList,
      }),
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();

    await getProjectAccessWithRoleOrThrow(
      id,
      session.user.id,
      ['owner', 'admin'] as const,
      'Forbidden'
    );

    const updates = await request.json();
    const allowedFields = ['name', 'description', 'productionBranch'];
    const filteredUpdates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(projects)
      .set({ ...filteredUpdates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();

    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    if (member.role !== 'owner') {
      return NextResponse.json({ error: 'Only owner can delete project' }, { status: 403 });
    }

    const envList = await db.query.environments.findMany({
      where: eq(environments.projectId, id),
    });

    initK8sClient();
    if (getIsConnected()) {
      const namespaces = [...new Set(envList.map((e) => e.namespace).filter(Boolean) as string[])];
      await Promise.allSettled(namespaces.map((ns) => deleteNamespace(ns)));
    }

    await db.delete(projects).where(eq(projects.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
