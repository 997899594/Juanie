import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getTeamAIControlPlane, updateTeamAIControlPlane } from '@/lib/ai/runtime/control-plane';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers } from '@/lib/db/schema';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
    columns: {
      id: true,
    },
  });

  if (!member) {
    return NextResponse.json({ error: '没有权限访问该团队' }, { status: 403 });
  }

  const snapshot = await getTeamAIControlPlane(id);
  return NextResponse.json(snapshot);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
    columns: {
      role: true,
    },
  });

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: '只有 owner 可以修改 AI 控制面' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    plan?: 'free' | 'pro' | 'scale' | 'enterprise';
    plugins?: Array<{ pluginId: string; enabled: boolean }>;
  } | null;

  if (!body?.plan || !Array.isArray(body.plugins)) {
    return NextResponse.json({ error: 'AI 配置不完整' }, { status: 400 });
  }

  const snapshot = await updateTeamAIControlPlane({
    teamId: id,
    plan: body.plan,
    plugins: body.plugins,
  });

  await createAuditLog({
    teamId: id,
    userId: session.user.id,
    action: 'team.ai_control_plane_updated',
    resourceType: 'team',
    resourceId: id,
    metadata: {
      plan: body.plan,
      plugins: body.plugins,
    },
  });

  return NextResponse.json(snapshot);
}
