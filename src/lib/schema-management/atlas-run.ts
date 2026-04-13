import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { db } from '@/lib/db';
import { projects, schemaRepairPlans } from '@/lib/db/schema';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';

const execFileAsync = promisify(execFile);

function buildAuthenticatedCloneUrl(input: {
  cloneUrl: string | null;
  fullName: string;
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted';
  accessToken: string;
}): string {
  const fallbackUrl =
    input.cloneUrl ??
    (input.provider === 'github'
      ? `https://github.com/${input.fullName}.git`
      : `https://gitlab.com/${input.fullName}.git`);
  const url = new URL(fallbackUrl);

  if (input.provider === 'github') {
    url.username = 'x-access-token';
    url.password = input.accessToken;
  } else {
    url.username = 'oauth2';
    url.password = input.accessToken;
  }

  return url.toString();
}

async function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
) {
  const result = await execFileAsync(command, args, {
    cwd: options?.cwd,
    env: options?.env,
    maxBuffer: 10 * 1024 * 1024,
  });

  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

function clipLog(value: string): string {
  return value.slice(-12000);
}

export async function runSchemaRepairAtlas(input: {
  projectId: string;
  planId: string;
  userId: string;
}) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    with: {
      repository: true,
    },
  });

  if (!project?.repository) {
    throw new Error('项目缺少仓库绑定');
  }

  const plan = await db.query.schemaRepairPlans.findFirst({
    where: eq(schemaRepairPlans.id, input.planId),
    with: {
      database: true,
    },
  });

  if (!plan || plan.projectId !== input.projectId) {
    throw new Error('修复计划不存在');
  }

  if (!plan.branchName) {
    throw new Error('修复计划还没有 branch');
  }

  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    actingUserId: input.userId,
    requiredCapabilities: ['write_repo'],
  });

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'juanie-schema-repair-'));
  const repoDir = path.join(tempRoot, 'repo');
  const cloneUrl = buildAuthenticatedCloneUrl({
    cloneUrl: project.repository.cloneUrl ?? null,
    fullName: project.repository.fullName,
    provider: session.provider,
    accessToken: session.accessToken,
  });
  const scriptPath = path.join(repoDir, '.juanie', 'schema-repair', `${plan.id}.atlas.sh`);
  const startTime = new Date();

  await db
    .update(schemaRepairPlans)
    .set({
      atlasExecutionStatus: 'running',
      atlasExecutionStartedAt: startTime,
      atlasExecutionFinishedAt: null,
      atlasExecutionLog: null,
      updatedAt: startTime,
    })
    .where(eq(schemaRepairPlans.id, plan.id));

  try {
    let logs = '';

    logs += await runCommand('git', [
      'clone',
      '--depth',
      '1',
      '--branch',
      plan.branchName,
      cloneUrl,
      repoDir,
    ]);
    logs += '\n';

    const env = {
      ...process.env,
      ATLAS_DEV_URL: process.env.ATLAS_DEV_URL ?? 'docker://postgres/16/dev',
      ATLAS_SRC_URL:
        plan.kind === 'adopt_current_db'
          ? (plan.database?.connectionString ?? '')
          : process.env.ATLAS_SRC_URL,
    };

    logs += await runCommand('bash', [scriptPath], {
      cwd: repoDir,
      env,
    });
    logs += '\n';

    const status = await runCommand('git', ['status', '--short'], { cwd: repoDir });
    if (status.trim().length > 0) {
      logs += status;
      logs += '\n';
      await runCommand('git', ['config', 'user.name', 'Juanie Bot'], { cwd: repoDir });
      await runCommand('git', ['config', 'user.email', 'noreply@juanie.art'], { cwd: repoDir });
      await runCommand('git', ['add', '.'], { cwd: repoDir });
      await runCommand(
        'git',
        ['commit', '-m', `chore: run atlas schema repair for ${plan.database?.name ?? 'database'}`],
        { cwd: repoDir }
      );
      await runCommand('git', ['push', 'origin', plan.branchName], { cwd: repoDir });
    }

    const finishedAt = new Date();
    const [updated] = await db
      .update(schemaRepairPlans)
      .set({
        atlasExecutionStatus: 'succeeded',
        atlasExecutionLog: clipLog(logs),
        atlasExecutionFinishedAt: finishedAt,
        updatedAt: finishedAt,
      })
      .where(eq(schemaRepairPlans.id, plan.id))
      .returning();

    await createAuditLog({
      teamId: project.teamId,
      userId: input.userId,
      action: 'project.updated',
      resourceType: 'project',
      resourceId: project.id,
      metadata: {
        schemaAction: 'run_atlas_repair',
        databaseId: plan.databaseId,
        planId: plan.id,
        branchName: plan.branchName,
      },
    });

    return updated;
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(schemaRepairPlans)
      .set({
        atlasExecutionStatus: 'failed',
        atlasExecutionLog: clipLog(message),
        atlasExecutionFinishedAt: finishedAt,
        errorMessage: message,
        updatedAt: finishedAt,
      })
      .where(eq(schemaRepairPlans.id, plan.id));
    throw error;
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}
