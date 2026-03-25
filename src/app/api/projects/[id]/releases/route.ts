import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, releases, teamMembers } from '@/lib/db/schema';
import { decorateReleaseList } from '@/lib/releases/view';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const releaseList = await db.query.releases.findMany({
    where: eq(releases.projectId, id),
    orderBy: [desc(releases.createdAt)],
    with: {
      environment: {
        with: {
          domains: {
            with: {
              service: true,
            },
          },
        },
      },
      artifacts: {
        with: {
          service: true,
        },
      },
      deployments: {
        with: {
          service: true,
        },
      },
      migrationRuns: {
        with: {
          service: true,
          database: true,
          specification: true,
        },
      },
    },
  });

  return NextResponse.json(decorateReleaseList(releaseList));
}
