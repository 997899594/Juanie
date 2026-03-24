import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { migrationRuns, projects, teamMembers } from '@/lib/db/schema';
import { createMigrationRun, getMigrationRunById } from '@/lib/migrations';
import { addMigrationJob } from '@/lib/queue';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id: projectId, runId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const run = await getMigrationRunById(runId);
  if (!run || run.projectId !== projectId) {
    return NextResponse.json({ error: 'Migration run not found' }, { status: 404 });
  }

  const { action, imageUrl } = await request.json().catch(() => ({}));

  if (action === 'approve') {
    if (run.status !== 'awaiting_approval') {
      return NextResponse.json(
        { error: 'Migration run is not awaiting approval' },
        { status: 400 }
      );
    }

    await db
      .update(migrationRuns)
      .set({
        status: 'queued',
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(migrationRuns.id, run.id));

    await addMigrationJob(run.id, {
      imageUrl: imageUrl ?? null,
      allowApprovalBypass: true,
    });

    return NextResponse.json(
      {
        message: 'Migration approved and requeued',
        runId: run.id,
      },
      { status: 202 }
    );
  }

  if (action === 'retry') {
    if (!['failed', 'canceled'].includes(run.status)) {
      return NextResponse.json(
        { error: 'Only failed or canceled runs can be retried' },
        { status: 400 }
      );
    }

    const retryRun = await createMigrationRun(
      {
        specification: run.specification,
        database: run.database,
        service: run.service,
        environment: run.environment,
      },
      {
        releaseId: run.releaseId,
        deploymentId: run.deploymentId,
        triggeredBy: 'manual',
        triggeredByUserId: session.user.id,
        sourceCommitSha: run.sourceCommitSha,
        sourceCommitMessage: run.sourceCommitMessage,
        runnerType: imageUrl ? 'k8s_job' : 'worker',
      }
    );

    await addMigrationJob(retryRun.id, {
      imageUrl: imageUrl ?? null,
      allowApprovalBypass: false,
    });

    return NextResponse.json(
      {
        message: 'Migration retry queued',
        runId: retryRun.id,
      },
      { status: 202 }
    );
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
