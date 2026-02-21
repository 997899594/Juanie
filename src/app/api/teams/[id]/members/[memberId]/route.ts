import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers, teams } from '@/lib/db/schema';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });

  if (!currentMember || currentMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only owner can change member roles' }, { status: 403 });
  }

  const { role } = await request.json();

  if (!role || !['admin', 'member', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const targetMember = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, memberId),
  });

  if (!targetMember || targetMember.teamId !== id) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
  }

  const [updated] = await db
    .update(teamMembers)
    .set({ role, updatedAt: new Date() })
    .where(eq(teamMembers.id, memberId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });

  if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
    return NextResponse.json({ error: 'Only owner/admin can remove members' }, { status: 403 });
  }

  const targetMember = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, memberId),
  });

  if (!targetMember || targetMember.teamId !== id) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove owner' }, { status: 400 });
  }

  if (targetMember.userId === session.user.id && currentMember.role !== 'owner') {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, memberId));

  return NextResponse.json({ success: true });
}
