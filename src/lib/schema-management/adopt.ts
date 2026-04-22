import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { runAtlasCommand } from '@/lib/atlas/cli';
import { createAuditLog } from '@/lib/audit';
import { db } from '@/lib/db';
import { databaseMigrations, projects } from '@/lib/db/schema';
import {
  getAtlasDeclaredVersions,
  isAtlasDatabaseTarget,
  prepareAtlasMigrationWorkspace,
  resolveAtlasDatabaseUrl,
} from '@/lib/migrations/atlas';
import { fetchMigrationFilesFromRepoPath } from '@/lib/migrations/fetch';
import { resolveMigrationPath } from '@/lib/migrations/path';
import {
  inspectEnvironmentSchemaState,
  resolveSchemaManagementSpec,
} from '@/lib/schema-management/inspect';

async function getProjectDefaultRef(projectId: string, branch?: string | null): Promise<string> {
  if (branch) {
    return branch;
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      repository: true,
    },
  });

  return project?.repository?.defaultBranch ?? 'main';
}

async function markSqlSchemaAligned(input: {
  projectId: string;
  databaseId: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}) {
  const spec = await resolveSchemaManagementSpec(input);
  if (!spec) {
    throw new Error('未找到迁移配置');
  }

  if (spec.specification.tool !== 'sql') {
    throw new Error('当前只支持为 SQL 工具执行账本接管');
  }

  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
  if (!migrationPath) {
    throw new Error('无法解析 SQL migration 路径');
  }

  const ref = await getProjectDefaultRef(spec.specification.projectId, spec.environment.branch);
  const migrationFiles = await fetchMigrationFilesFromRepoPath(
    spec.specification.projectId,
    migrationPath,
    input.sourceCommitSha ?? input.sourceRef ?? ref
  );

  if (migrationFiles.length === 0) {
    throw new Error('仓库中没有可接管的 SQL 迁移文件');
  }

  const now = new Date();

  for (const file of migrationFiles) {
    await db
      .insert(databaseMigrations)
      .values({
        databaseId: spec.database.id,
        filename: file.name,
        checksum: crypto.createHash('sha256').update(file.content).digest('hex'),
        status: 'success',
        output: 'marked aligned by platform',
        executedAt: now,
      })
      .onConflictDoNothing();
  }
}

export function canMarkSchemaAligned(input: {
  tool: 'atlas' | 'drizzle' | 'sql' | 'prisma' | 'knex' | 'typeorm' | 'custom';
  databaseType: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
}): boolean {
  if (input.tool === 'atlas' || input.tool === 'sql') {
    return input.databaseType === 'postgresql' || input.databaseType === 'mysql';
  }

  return false;
}

async function markAtlasSchemaAligned(input: {
  projectId: string;
  databaseId: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}) {
  const spec = await resolveSchemaManagementSpec(input);
  if (!spec) {
    throw new Error('未找到迁移配置');
  }

  if (
    spec.specification.tool !== 'atlas' ||
    !canMarkSchemaAligned({
      tool: spec.specification.tool,
      databaseType: spec.database.type,
    }) ||
    !isAtlasDatabaseTarget(spec.database)
  ) {
    throw new Error('当前只支持为 PostgreSQL / MySQL + Atlas 执行账本接管');
  }

  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
  if (!migrationPath) {
    throw new Error('无法解析 Atlas migration 路径');
  }

  const ref = await getProjectDefaultRef(spec.specification.projectId, spec.environment.branch);
  const revision = input.sourceCommitSha ?? input.sourceRef ?? ref;
  const databaseUrl = resolveAtlasDatabaseUrl(spec.database);

  if (!databaseUrl) {
    throw new Error('数据库缺少可用的连接信息，无法执行 Atlas 账本接管');
  }

  const workspace = await prepareAtlasMigrationWorkspace({
    projectId: spec.specification.projectId,
    migrationPath,
    revision,
  });

  try {
    const declaredVersions = getAtlasDeclaredVersions(workspace.files);
    const latestVersion = declaredVersions.at(-1);

    if (!latestVersion) {
      throw new Error('仓库中没有可接管的 Atlas 迁移版本');
    }

    await runAtlasCommand(
      ['migrate', 'set', latestVersion, '--dir', 'file://migrations', '--url', databaseUrl],
      {
        cwd: workspace.dir,
      }
    );

    const now = new Date();

    for (const file of workspace.files) {
      await db
        .insert(databaseMigrations)
        .values({
          databaseId: spec.database.id,
          filename: file.name,
          checksum: crypto.createHash('sha256').update(file.content).digest('hex'),
          status: 'success',
          output: 'marked aligned by platform',
          executedAt: now,
        })
        .onConflictDoNothing();
    }
  } finally {
    await workspace.cleanup();
  }
}

export async function markEnvironmentSchemaAligned(input: {
  projectId: string;
  databaseId: string;
  userId: string;
}): Promise<Awaited<ReturnType<typeof inspectEnvironmentSchemaState>>> {
  const current = await inspectEnvironmentSchemaState({
    projectId: input.projectId,
    databaseId: input.databaseId,
  });

  if (current.status !== 'aligned_untracked') {
    throw new Error('只有账本缺失的数据库才能标记为已对齐');
  }

  const spec = await resolveSchemaManagementSpec({
    projectId: input.projectId,
    databaseId: input.databaseId,
  });

  if (!spec) {
    throw new Error('未找到迁移配置');
  }

  if (
    !canMarkSchemaAligned({
      tool: spec.specification.tool,
      databaseType: spec.database.type,
    })
  ) {
    throw new Error('当前工具暂不支持标记为已对齐');
  }

  if (spec.specification.tool === 'sql') {
    await markSqlSchemaAligned({
      projectId: input.projectId,
      databaseId: input.databaseId,
    });
  } else if (spec.specification.tool === 'atlas') {
    await markAtlasSchemaAligned({
      projectId: input.projectId,
      databaseId: input.databaseId,
    });
  } else {
    throw new Error('当前工具暂不支持标记为已对齐');
  }

  const next = await inspectEnvironmentSchemaState({
    projectId: input.projectId,
    databaseId: input.databaseId,
  });

  if (next.status !== 'aligned') {
    throw new Error('账本接管后状态仍未对齐');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    columns: {
      id: true,
      teamId: true,
    },
  });

  if (project) {
    await createAuditLog({
      teamId: project.teamId,
      userId: input.userId,
      action: 'project.updated',
      resourceType: 'project',
      resourceId: project.id,
      metadata: {
        databaseId: input.databaseId,
        schemaAction: 'mark_aligned',
        tool: spec.specification.tool,
      },
    });
  }

  return next;
}
