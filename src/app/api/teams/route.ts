import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers, teams, users } from '@/lib/db/schema';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userTeams = await db
    .select({
      team: teams,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, session.user.id));

  return NextResponse.json(userTeams);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, slug } = await request.json();

  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
  }

  const existingTeam = await db.query.teams.findFirst({
    where: eq(teams.slug, slug),
  });

  if (existingTeam) {
    return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
  }

  const [team] = await db.insert(teams).values({ name, slug }).returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: session.user.id,
    role: 'owner',
  });

  return NextResponse.json(team, { status: 201 });
}
