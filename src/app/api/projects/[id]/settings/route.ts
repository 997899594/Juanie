import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, teamMembers, teams } from '@/lib/db/schema';
import { deleteNamespace, getIsConnected, initK8sClient } from '@/lib/k8s';
import { buildProjectGovernanceSnapshot } from '@/lib/projects/settings-view';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      repository: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!teamMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, project.teamId),
  });
  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, id),
  });

  return NextResponse.json({
    ...project,
    repositoryFullName: project.repository?.fullName ?? null,
    repositoryWebUrl: project.repository?.webUrl ?? null,
    teamName: team?.name,
    teamSlug: team?.slug,
    yourRole: teamMember.role,
    governance: buildProjectGovernanceSnapshot({
      role: teamMember.role,
      environments: environmentList,
    }),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!teamMember || !['owner', 'admin'].includes(teamMember.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!teamMember || teamMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only owner can delete project' }, { status: 403 });
  }

  // 删除 K8s namespace（级联删除所有 pod、service、httproute 等资源）
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
}
