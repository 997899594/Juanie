import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';
import { ensurePreviewEnvironmentForRef } from '@/lib/environments/service';

async function authorizeProject(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return { project: null, forbidden: false };
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
  });

  return {
    project,
    forbidden: !member,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { project, forbidden } = await authorizeProject(id, session.user.id);

  if (!project) {
    return NextResponse.json(
      { error: forbidden ? '没有权限访问项目' : '项目不存在' },
      { status: forbidden ? 403 : 404 }
    );
  }

  const previewEnvironments = await db.query.environments.findMany({
    where: and(eq(environments.projectId, id), eq(environments.isPreview, true)),
  });

  return NextResponse.json(previewEnvironments);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { project, forbidden } = await authorizeProject(id, session.user.id);

  if (!project) {
    return NextResponse.json(
      { error: forbidden ? '没有权限访问项目' : '项目不存在' },
      { status: forbidden ? 403 : 404 }
    );
  }

  const body = await request.json();
  const branch =
    typeof body.branch === 'string' && body.branch.trim().length > 0 ? body.branch.trim() : null;
  const prNumber =
    typeof body.prNumber === 'number' && Number.isInteger(body.prNumber) && body.prNumber > 0
      ? body.prNumber
      : null;
  const ttlHours =
    typeof body.ttlHours === 'number' && Number.isFinite(body.ttlHours) ? body.ttlHours : 72;

  if (!branch && !prNumber) {
    return NextResponse.json({ error: '预览环境需要分支或 PR 号' }, { status: 400 });
  }
  const ref = prNumber ? `refs/pull/${prNumber}/merge` : `refs/heads/${branch}`;
  const environment = await ensurePreviewEnvironmentForRef({
    projectId: id,
    projectSlug: project.slug,
    ref,
    ttlHours,
  });

  return NextResponse.json(environment, { status: environment ? 201 : 200 });
}
