import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers, teams, users } from '@/lib/db/schema';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, id),
  });

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });

  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const members = await db
    .select({
      id: teamMembers.id,
      role: teamMembers.role,
      createdAt: teamMembers.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, id));

  return NextResponse.json(members);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Only owner can invite members' }, { status: 403 });
  }

  const { email, role = 'member' } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const existingMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, user.id)),
  });

  if (existingMember) {
    return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
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
