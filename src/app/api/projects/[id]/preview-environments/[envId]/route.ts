import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';
import { deletePreviewEnvironmentById } from '@/lib/environments/cleanup';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  const { id, envId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: '没有权限删除预览环境' }, { status: 403 });
  }

  const environment = await db.query.environments.findFirst({
    where: and(eq(environments.id, envId), eq(environments.projectId, id)),
  });

  if (!environment) {
    return NextResponse.json({ error: '预览环境不存在' }, { status: 404 });
  }

  const result = await deletePreviewEnvironmentById(envId);
  if (!result.deleted) {
    if (result.reason === 'active_release') {
      return NextResponse.json(
        { error: '预览环境仍有活跃中的发布，暂时不能删除' },
        { status: 409 }
      );
    }

    if (result.reason === 'not_preview') {
      return NextResponse.json({ error: '目标环境不是预览环境' }, { status: 400 });
    }

    return NextResponse.json({ error: '删除预览环境失败' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
