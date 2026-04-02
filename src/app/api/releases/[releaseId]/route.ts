import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { releases, teamMembers } from '@/lib/db/schema';
import { getReleaseById } from '@/lib/releases';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  const { releaseId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    with: {
      project: true,
    },
  });

  if (!release) {
    return NextResponse.json({ error: 'Release not found' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, release.project.teamId),
      eq(teamMembers.userId, session.user.id)
    ),
  });

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fullRelease = await getReleaseById(releaseId);
  return NextResponse.json(fullRelease);
}
