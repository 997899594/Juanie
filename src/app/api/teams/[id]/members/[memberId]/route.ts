import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getTeamAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { teamMembers } from '@/lib/db/schema';
import { applyMemberRemovalSafeguards } from '@/lib/teams/offboarding-service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const session = await requireSession();
    const { member: currentMember } = await getTeamAccessOrThrow(id, session.user.id);

    if (currentMember.role !== 'owner') {
      return NextResponse.json({ error: '只有 owner 可以调整成员角色' }, { status: 403 });
    }

    const { role } = await request.json();

    if (!role || !['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: '角色无效' }, { status: 400 });
    }

    const targetMember = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, id)),
    });

    if (!targetMember) {
      return NextResponse.json({ error: '没有找到这个成员' }, { status: 404 });
    }

    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: '不能修改 owner 的角色' }, { status: 400 });
    }

    const [updated] = await db
      .update(teamMembers)
      .set({ role, updatedAt: new Date() })
      .where(eq(teamMembers.id, memberId))
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const session = await requireSession();
    const { member: currentMember } = await getTeamAccessOrThrow(id, session.user.id);

    if (!['owner', 'admin'].includes(currentMember.role)) {
      return NextResponse.json({ error: '只有 owner 或 admin 可以移除成员' }, { status: 403 });
    }

    const targetMember = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, id)),
    });

    if (!targetMember) {
      return NextResponse.json({ error: '没有找到这个成员' }, { status: 404 });
    }

    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: '不能移除 owner' }, { status: 400 });
    }

    if (targetMember.userId === session.user.id && currentMember.role !== 'owner') {
      return NextResponse.json({ error: 'admin 不能移除自己' }, { status: 400 });
    }

    const impact = await applyMemberRemovalSafeguards({
      teamId: id,
      targetUserId: targetMember.userId,
    });

    if (impact.blocking) {
      return NextResponse.json(
        { error: impact.blockingReason ?? '成员移除被阻止，请先调整团队集成绑定后再试' },
        { status: 409 }
      );
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, memberId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
