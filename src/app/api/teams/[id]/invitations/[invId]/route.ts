import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getTeamAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { teamInvitations } from '@/lib/db/schema';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; invId: string }> }
) {
  try {
    const { id, invId } = await params;
    const session = await requireSession();
    const { member } = await getTeamAccessOrThrow(id, session.user.id);

    if (!['owner', 'admin'].includes(member.role)) {
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
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
