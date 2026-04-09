import { randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getTeamAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { teamInvitations } from '@/lib/db/schema';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { member } = await getTeamAccessOrThrow(id, session.user.id);

    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: '当前角色不能查看邀请链接' }, { status: 403 });
    }

    const now = new Date();
    const invitations = await db.query.teamInvitations.findMany({
      where: and(eq(teamInvitations.teamId, id), gt(teamInvitations.expires, now)),
    });

    return NextResponse.json(invitations);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { member } = await getTeamAccessOrThrow(id, session.user.id);

    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: '当前角色不能生成邀请链接' }, { status: 403 });
    }

    const { role = 'member' } = await request.json();

    const validRoles = ['admin', 'member'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: '角色无效' }, { status: 400 });
    }

    const token = randomUUID();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invitation] = await db
      .insert(teamInvitations)
      .values({
        teamId: id,
        role,
        token,
        expires,
      })
      .returning();

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
    const inviteUrl = `${baseUrl}/invite/${token}`;

    return NextResponse.json({ invitation, inviteUrl }, { status: 201 });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
