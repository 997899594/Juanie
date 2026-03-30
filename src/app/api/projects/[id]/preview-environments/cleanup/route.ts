import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { cleanupExpiredPreviewEnvironments } from '@/lib/environments/cleanup';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    return NextResponse.json({ error: '没有权限执行预览环境治理' }, { status: 403 });
  }

  const result = await cleanupExpiredPreviewEnvironments({
    projectId: id,
  });

  await createAuditLog({
    teamId: project.teamId,
    userId: session.user.id,
    action: 'environment.preview_cleanup_completed',
    resourceType: 'environment',
    metadata: {
      projectId: id,
      deletedIds: result.deletedIds,
      skipped: result.skipped,
      deletedCount: result.deletedIds.length,
      blockedCount: result.skipped.filter((item) => item.reason === 'active_release').length,
    },
  });

  return NextResponse.json(result);
}
