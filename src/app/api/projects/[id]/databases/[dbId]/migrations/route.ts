import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  databases,
  migrationRuns,
  migrationSpecifications,
  projects,
  teamMembers,
} from '@/lib/db/schema';
import {
  buildMigrationExecutionPlan,
  createMigrationRun,
  getMigrationRunById,
} from '@/lib/migrations';
import { addMigrationJob } from '@/lib/queue';

function getExpectedConfirmationValue(databaseName: string, environmentName: string): string {
  return `${databaseName}/${environmentName}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  const { id: projectId, dbId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. 验证权限
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

  // 2. 获取数据库
  const database = await db.query.databases.findFirst({
    where: and(eq(databases.id, dbId), eq(databases.projectId, projectId)),
  });

  if (!database) {
    return NextResponse.json({ error: 'Database not found' }, { status: 404 });
  }

  if (!database.environmentId) {
    return NextResponse.json({ error: 'Database environment is missing' }, { status: 400 });
  }

  const specification = await db.query.migrationSpecifications.findFirst({
    where: and(
      eq(migrationSpecifications.projectId, projectId),
      eq(migrationSpecifications.databaseId, dbId),
      eq(migrationSpecifications.environmentId, database.environmentId)
    ),
    with: {
      service: true,
      environment: true,
    },
  });

  if (!specification) {
    return NextResponse.json({ error: 'Migration specification not found' }, { status: 404 });
  }

  try {
    const {
      action = 'run',
      runId,
      imageUrl,
      confirmationText,
    } = await request.json().catch(() => ({}));
    const expectedConfirmationValue = getExpectedConfirmationValue(
      database.name,
      specification.environment.name
    );

    if (action === 'plan') {
      const plan = await buildMigrationExecutionPlan(
        {
          specification,
          database,
          service: specification.service,
          environment: specification.environment,
        },
        {
          imageUrl: imageUrl ?? null,
        }
      );

      return NextResponse.json(plan);
    }

    if (database.status !== 'running') {
      return NextResponse.json({ error: 'Database is not running' }, { status: 400 });
    }

    if (action === 'approve') {
      if (!runId) {
        return NextResponse.json({ error: 'runId is required for approve' }, { status: 400 });
      }

      const run = await getMigrationRunById(runId);
      if (!run || run.databaseId !== dbId || run.projectId !== projectId) {
        return NextResponse.json({ error: 'Migration run not found' }, { status: 404 });
      }
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
          message: '迁移审批通过，已重新加入队列',
          runId: run.id,
        },
        { status: 202 }
      );
    }

    if (action === 'retry') {
      if (!runId) {
        return NextResponse.json({ error: 'runId is required for retry' }, { status: 400 });
      }

      const previousRun = await getMigrationRunById(runId);
      if (!previousRun || previousRun.databaseId !== dbId || previousRun.projectId !== projectId) {
        return NextResponse.json({ error: 'Migration run not found' }, { status: 404 });
      }
      if (!['failed', 'canceled'].includes(previousRun.status)) {
        return NextResponse.json(
          { error: 'Only failed or canceled runs can be retried' },
          { status: 400 }
        );
      }

      const retryRun = await createMigrationRun(
        {
          specification,
          database,
          service: specification.service,
          environment: specification.environment,
        },
        {
          triggeredBy: 'manual',
          triggeredByUserId: session.user.id,
          sourceCommitSha: previousRun.sourceCommitSha,
          sourceCommitMessage: previousRun.sourceCommitMessage,
          runnerType: imageUrl ? 'k8s_job' : 'worker',
        }
      );

      await addMigrationJob(retryRun.id, {
        imageUrl: imageUrl ?? null,
        allowApprovalBypass: false,
      });

      return NextResponse.json(
        {
          message: '迁移重试已加入队列',
          runId: retryRun.id,
        },
        { status: 202 }
      );
    }

    if (confirmationText !== expectedConfirmationValue) {
      return NextResponse.json(
        {
          error: `Confirmation text mismatch. Expected ${expectedConfirmationValue}`,
        },
        { status: 400 }
      );
    }

    const run = await createMigrationRun(
      {
        specification,
        database,
        service: specification.service,
        environment: specification.environment,
      },
      {
        triggeredBy: 'manual',
        triggeredByUserId: session.user.id,
        runnerType: imageUrl ? 'k8s_job' : 'worker',
      }
    );

    await addMigrationJob(run.id, { imageUrl, allowApprovalBypass: false });

    return NextResponse.json(
      {
        message: '迁移已加入队列',
        runId: run.id,
      },
      { status: 202 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '迁移执行失败' }, { status: 500 });
  }
}

// GET - 获取迁移历史
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  const { id: projectId, dbId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 验证权限
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
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

  const database = await db.query.databases.findFirst({
    where: and(eq(databases.id, dbId), eq(databases.projectId, projectId)),
  });
  if (!database) {
    return NextResponse.json({ error: 'Database not found' }, { status: 404 });
  }

  const runs = await db.query.migrationRuns.findMany({
    where: eq(migrationRuns.databaseId, dbId),
    with: {
      environment: true,
      specification: true,
      items: true,
      service: true,
    },
    orderBy: (run, { desc }) => [desc(run.createdAt)],
  });

  return NextResponse.json(runs);
}
