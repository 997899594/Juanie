import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamInvitations, teamMembers, teams } from '@/lib/db/schema';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; invId: string }> }
) {
  const { id, invId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const team = await db.query.teams.findFirst({ where: eq(teams.id, id) });
  if (!team) {
    return NextResponse.json({ error: '没有找到团队' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });

  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: '当前角色不能撤销邀请链接' }, { status: 403 });
  }

  const invitation = await db.query.teamInvitations.findFirst({
    where: and(eq(teamInvitations.id, invId), eq(teamInvitations.teamId, id)),
  });

  if (!invitation) {
    return NextResponse.json({ error: '没有找到这个邀请' }, { status: 404 });
  }

  await db.delete(teamInvitations).where(eq(teamInvitations.id, invId));

  return NextResponse.json({ success: true });
}
