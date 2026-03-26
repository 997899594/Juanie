import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers, users } from '@/lib/db/schema';
import { getTeamMembersPageData } from '@/lib/teams/service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const pageData = await getTeamMembersPageData(id, session.user.id);

  if (!pageData) {
    return NextResponse.json({ error: '团队不存在或无权限访问' }, { status: 404 });
  }

  return NextResponse.json({
    governance: pageData.overview.governance,
    members: pageData.overview.members,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: '只有 owner 可以直接邀请成员' }, { status: 403 });
  }

  const { email, role = 'member' } = await request.json();

  if (!email) {
    return NextResponse.json({ error: '邮箱不能为空' }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return NextResponse.json({ error: '没有找到这个用户' }, { status: 404 });
  }

  const existingMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, user.id)),
  });

  if (existingMember) {
    return NextResponse.json({ error: '这个用户已经在团队里了' }, { status: 400 });
  }

  const [newMember] = await db
    .insert(teamMembers)
    .values({
      teamId: id,
      userId: user.id,
      role,
    })
    .returning();

  return NextResponse.json(newMember, { status: 201 });
}
