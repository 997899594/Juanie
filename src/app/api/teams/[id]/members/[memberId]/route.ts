import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers } from '@/lib/db/schema';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const currentMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });

  if (!currentMember || currentMember.role !== 'owner') {
    return NextResponse.json({ error: '只有 owner 可以调整成员角色' }, { status: 403 });
  }

  const { role } = await request.json();

  if (!role || !['admin', 'member'].includes(role)) {
    return NextResponse.json({ error: '角色无效' }, { status: 400 });
  }

  const targetMember = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, memberId),
  });

  if (!targetMember || targetMember.teamId !== id) {
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
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const currentMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });

  if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
    return NextResponse.json({ error: '只有 owner 或 admin 可以移除成员' }, { status: 403 });
  }

  const targetMember = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, memberId),
  });

  if (!targetMember || targetMember.teamId !== id) {
    return NextResponse.json({ error: '没有找到这个成员' }, { status: 404 });
  }

  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: '不能移除 owner' }, { status: 400 });
  }

  if (targetMember.userId === session.user.id && currentMember.role !== 'owner') {
    return NextResponse.json({ error: 'admin 不能移除自己' }, { status: 400 });
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, memberId));

  return NextResponse.json({ success: true });
}
