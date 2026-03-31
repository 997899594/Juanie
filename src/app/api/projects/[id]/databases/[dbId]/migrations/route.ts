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
  findActiveMigrationRun,
  getMigrationRunById,
} from '@/lib/migrations';
import { syncMigrationSpecificationsFromRepo } from '@/lib/migrations/resolver';
import type { MigrationResolutionInfo, ResolvedMigrationSpec } from '@/lib/migrations/types';
import { addMigrationJob } from '@/lib/queue';

function getExpectedConfirmationValue(databaseName: string, environmentName: string): string {
  return `${databaseName}/${environmentName}`;
}

function getUnknownResolution(): MigrationResolutionInfo {
  return {
    strategy: 'unknown',
    selector: {
      bindingName: null,
      bindingRole: null,
      bindingDatabaseType: null,
    },
  };
}

function buildResolvedSpec(
  specification: ResolvedMigrationSpec['specification'] & {
    service: ResolvedMigrationSpec['service'];
    environment: ResolvedMigrationSpec['environment'];
  },
  database: ResolvedMigrationSpec['database'],
  syncedSpecs: ResolvedMigrationSpec[]
): ResolvedMigrationSpec {
  const synced = syncedSpecs.find((item) => item.specification.id === specification.id);

  return {
    specification,
    database,
    service: specification.service,
    environment: specification.environment,
    resolution: synced?.resolution ?? getUnknownResolution(),
  };
}

function pickResolvedSpecForDatabase(
  databaseId: string,
  environmentId: string,
  syncedSpecs: ResolvedMigrationSpec[]
): ResolvedMigrationSpec | null {
  const candidates = syncedSpecs.filter(
    (item) => item.database.id === databaseId && item.environment.id === environmentId
  );

  if (candidates.length === 0) {
    return null;
  }

  const serviceScoped = candidates.find((item) => item.database.serviceId === item.service.id);
  return serviceScoped ?? candidates[0] ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  const { id: projectId, dbId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 1. 验证权限
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: '没有权限执行这个操作' }, { status: 403 });
  }

  // 2. 获取数据库
  const database = await db.query.databases.findFirst({
    where: and(eq(databases.id, dbId), eq(databases.projectId, projectId)),
  });

  if (!database) {
    return NextResponse.json({ error: '数据库不存在' }, { status: 404 });
  }

  if (!database.environmentId) {
    return NextResponse.json({ error: '数据库缺少环境信息' }, { status: 400 });
  }

  const syncedSpecs = await syncMigrationSpecificationsFromRepo(projectId, database.environmentId);
  const syncedSpec = pickResolvedSpecForDatabase(dbId, database.environmentId, syncedSpecs);

  const persistedSpecification = syncedSpec
    ? null
    : await db.query.migrationSpecifications.findFirst({
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

  const resolvedSpec = syncedSpec
    ? syncedSpec
    : persistedSpecification
      ? buildResolvedSpec(persistedSpecification, database, syncedSpecs)
      : null;

  if (!resolvedSpec) {
    return NextResponse.json({ error: '没有找到迁移配置' }, { status: 404 });
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
      resolvedSpec.environment.name
    );

    if (action === 'plan') {
      const plan = await buildMigrationExecutionPlan(resolvedSpec, {
        imageUrl: imageUrl ?? null,
      });

      return NextResponse.json(plan);
    }

    if (database.status !== 'running') {
      return NextResponse.json({ error: '数据库当前不可执行迁移' }, { status: 400 });
    }

    if (action === 'approve') {
      if (!runId) {
        return NextResponse.json({ error: '审批操作缺少 runId' }, { status: 400 });
      }

      const run = await getMigrationRunById(runId);
      if (!run || run.databaseId !== dbId || run.projectId !== projectId) {
        return NextResponse.json({ error: '迁移记录不存在' }, { status: 404 });
      }
      if (run.status !== 'awaiting_approval') {
        return NextResponse.json({ error: '当前迁移不在待审批状态' }, { status: 400 });
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
        return NextResponse.json({ error: '重试操作缺少 runId' }, { status: 400 });
      }

      const previousRun = await getMigrationRunById(runId);
      if (!previousRun || previousRun.databaseId !== dbId || previousRun.projectId !== projectId) {
        return NextResponse.json({ error: '迁移记录不存在' }, { status: 404 });
      }
      if (!['failed', 'canceled'].includes(previousRun.status)) {
        return NextResponse.json({ error: '只有失败或已取消的迁移才能重试' }, { status: 400 });
      }

      const activeRun = await findActiveMigrationRun({
        databaseId: previousRun.databaseId,
        environmentId: previousRun.environmentId,
      });

      if (activeRun) {
        return NextResponse.json(
          {
            error: `已有迁移正在处理中（${activeRun.status}）`,
            runId: activeRun.id,
          },
          { status: 409 }
        );
      }

      const retryRun = await createMigrationRun(resolvedSpec, {
        triggeredBy: 'manual',
        triggeredByUserId: session.user.id,
        sourceCommitSha: previousRun.sourceCommitSha,
        sourceCommitMessage: previousRun.sourceCommitMessage,
        runnerType: imageUrl ? 'k8s_job' : 'worker',
      });

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
          error: `确认文本不匹配，应输入 ${expectedConfirmationValue}`,
        },
        { status: 400 }
      );
    }

    const activeRun = await findActiveMigrationRun({
      databaseId: resolvedSpec.database.id,
      environmentId: resolvedSpec.environment.id,
    });

    if (activeRun) {
      return NextResponse.json(
        {
          error: `已有迁移正在处理中（${activeRun.status}）`,
          runId: activeRun.id,
        },
        { status: 409 }
      );
    }

    const run = await createMigrationRun(resolvedSpec, {
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      runnerType: imageUrl ? 'k8s_job' : 'worker',
    });

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
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 验证权限
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    return NextResponse.json({ error: '没有权限查看迁移记录' }, { status: 403 });
  }

  const database = await db.query.databases.findFirst({
    where: and(eq(databases.id, dbId), eq(databases.projectId, projectId)),
  });
  if (!database) {
    return NextResponse.json({ error: '数据库不存在' }, { status: 404 });
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
