import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers, teams } from '@/lib/db/schema';
import { getTeamSettingsPageData } from '@/lib/teams/service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const pageData = await getTeamSettingsPageData(id, session.user.id);

  if (!pageData) {
    return NextResponse.json({ error: '团队不存在或无权限访问' }, { status: 404 });
  }

  return NextResponse.json({
    id: pageData.team.id,
    name: pageData.team.name,
    slug: pageData.team.slug,
    yourRole: pageData.member.role,
    governance: pageData.overview.governance,
    overview: pageData.overview,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: '只有 owner 可以修改团队' }, { status: 403 });
  }

  const { name } = await request.json();

  if (!name) {
    return NextResponse.json({ error: '团队名称不能为空' }, { status: 400 });
  }

  const [updated] = await db
    .update(teams)
    .set({ name, updatedAt: new Date() })
    .where(eq(teams.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: '只有 owner 可以删除团队' }, { status: 403 });
  }

  await db.delete(teams).where(eq(teams.id, id));

  return NextResponse.json({ success: true });
}
