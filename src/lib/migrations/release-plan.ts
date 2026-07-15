import { createHash, randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRuns, releaseMigrationPlans, releases } from '@/lib/db/schema';
import { assertExecutionFence, buildMigrationExecutionKey } from '@/lib/execution/ownership';
import {
  extractAtlasMigrationVersion,
  getAppliedAtlasVersions,
  isAtlasDatabaseTarget,
} from '@/lib/migrations/atlas';
import { fetchMigrationFilesFromRepoPath } from '@/lib/migrations/fetch';
import { inspectResolvedMigrationSpecPendingState } from '@/lib/migrations/file-preview';
import type {
  MigrationFilePreviewDetail,
  MigrationFilePreviewSnapshot,
} from '@/lib/migrations/file-preview-types';
import { resolveMigrationPath } from '@/lib/migrations/path';
import type {
  ReleaseMigrationPlanSnapshot,
  ReleaseMigrationPlanStageSnapshot,
} from '@/lib/migrations/release-plan-types';
import { syncMigrationSpecificationsFromRepo } from '@/lib/migrations/resolver';
import { createMigrationSpecificationSnapshot } from '@/lib/migrations/specification-snapshot';
import type { ResolvedMigrationSpec } from '@/lib/migrations/types';
import { enqueueOutboxMessage } from '@/lib/outbox/service';
import { appendReleaseEvent } from '@/lib/releases/events';
import { getEnvironmentSchemaStateRevision } from '@/lib/schema-management/inspect';
import { isSchemaStateForRequestedRevision } from '@/lib/schema-management/revision';

interface ReleasePlanSource {
  id: string;
  projectId: string;
  environmentId: string;
  sourceRepository: string;
  sourceRef: string;
  sourceCommitSha: string | null;
  configCommitSha: string | null;
  environment: {
    isProduction: boolean;
  };
}

export class ReleaseMigrationPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReleaseMigrationPlanError';
  }
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`;
}

export function computeReleaseMigrationPlanDigest(snapshot: ReleaseMigrationPlanSnapshot): string {
  return createHash('sha256').update(stableSerialize(snapshot)).digest('hex');
}

function requireImmutableCommit(release: ReleasePlanSource): string {
  const revision = release.configCommitSha ?? release.sourceCommitSha;
  if (!revision || !/^[0-9a-f]{7,64}$/iu.test(revision)) {
    throw new ReleaseMigrationPlanError('发布缺少不可变 Git commit，不能生成迁移审批计划');
  }
  return revision;
}

function getPreviewLanguage(pathname: string): MigrationFilePreviewDetail['language'] {
  if (pathname.endsWith('.sql')) return 'sql';
  if (pathname.endsWith('.ts')) return 'typescript';
  if (pathname.endsWith('.js') || pathname.endsWith('.mjs') || pathname.endsWith('.cjs')) {
    return 'javascript';
  }
  return 'text';
}

function assertCompletePreview(
  spec: ResolvedMigrationSpec,
  state: 'pending' | 'none' | 'unknown',
  preview: MigrationFilePreviewSnapshot | null
): MigrationFilePreviewSnapshot {
  const label = `${spec.service.name}/${spec.database.name}/${spec.specification.releaseStage}`;
  if (state === 'unknown' || !preview) {
    throw new ReleaseMigrationPlanError(`${label} 的迁移内容无法确认，发布已阻断`);
  }
  if (preview.warning) {
    throw new ReleaseMigrationPlanError(`${label} 的迁移预览不完整：${preview.warning}`);
  }
  if (preview.truncated || preview.fileDetails?.some((file) => file.truncated)) {
    throw new ReleaseMigrationPlanError(`${label} 的迁移内容被截断，不能审批`);
  }
  if (preview.total > 0 && preview.fileDetails?.length !== preview.total) {
    throw new ReleaseMigrationPlanError(`${label} 缺少完整迁移文件内容，不能审批`);
  }
  if (preview.fileDetails?.some((file) => file.content.trim().length === 0)) {
    throw new ReleaseMigrationPlanError(`${label} 包含空迁移文件，不能审批`);
  }
  return preview;
}

async function buildStandardStagePreview(
  spec: ResolvedMigrationSpec,
  sourceCommitSha: string,
  sourceRef: string
): Promise<MigrationFilePreviewSnapshot> {
  const inspection = await inspectResolvedMigrationSpecPendingState(spec, {
    sourceRef,
    sourceCommitSha,
    forceRefresh: true,
    includeFileDetails: true,
  });
  return assertCompletePreview(spec, inspection.state, inspection.preview);
}

async function buildAtlasStagePreviews(
  specs: ResolvedMigrationSpec[],
  sourceCommitSha: string
): Promise<Map<string, MigrationFilePreviewSnapshot>> {
  const previews = new Map<string, MigrationFilePreviewSnapshot>();
  const groups = new Map<string, ResolvedMigrationSpec[]>();

  for (const spec of specs) {
    const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);
    if (!migrationPath || !isAtlasDatabaseTarget(spec.database)) {
      throw new ReleaseMigrationPlanError(
        `${spec.service.name}/${spec.database.name} 缺少可执行的 Atlas 迁移目录或数据库连接`
      );
    }
    const key = `${spec.service.id}:${spec.database.id}:${migrationPath}`;
    groups.set(key, [...(groups.get(key) ?? []), spec]);
  }

  for (const group of groups.values()) {
    const first = group[0];
    if (!first || !isAtlasDatabaseTarget(first.database)) {
      throw new ReleaseMigrationPlanError('Atlas 迁移计划包含不支持的数据库类型');
    }
    const migrationPath = resolveMigrationPath(first.specification, first.database.type)!;
    const files = (
      await fetchMigrationFilesFromRepoPath(
        first.specification.projectId,
        migrationPath,
        sourceCommitSha
      )
    ).filter((file) => file.name.endsWith('.sql'));
    const declaredVersions = new Set(
      files
        .map((file) => extractAtlasMigrationVersion(file.name))
        .filter((version): version is string => Boolean(version))
    );
    const appliedVersions = new Set(await getAppliedAtlasVersions(first.database));
    const ordered = [...group].sort(
      (left, right) => left.specification.stageOrder - right.specification.stageOrder
    );
    let previousTarget = ordered[0]?.specification.baselineVersion ?? null;

    for (const spec of ordered) {
      const target = spec.specification.targetVersion;
      if (target && !declaredVersions.has(target)) {
        throw new ReleaseMigrationPlanError(
          `${spec.service.name}/${spec.database.name}/${spec.specification.releaseStage} 指向不存在的 Atlas 版本 ${target}`
        );
      }

      const stageFiles = files.filter((file) => {
        const version = extractAtlasMigrationVersion(file.name);
        if (!version) return false;
        if (previousTarget && BigInt(version) <= BigInt(previousTarget)) return false;
        if (target && BigInt(version) > BigInt(target)) return false;
        return true;
      });
      const pendingFiles = stageFiles.filter((file) => {
        const version = extractAtlasMigrationVersion(file.name);
        return !version || !appliedVersions.has(version);
      });
      if (pendingFiles.some((file) => file.content.trim().length === 0)) {
        throw new ReleaseMigrationPlanError(
          `${spec.service.name}/${spec.database.name}/${spec.specification.releaseStage} 包含空迁移文件`
        );
      }

      previews.set(spec.specification.id, {
        sourceLabel: `Atlas commit ${sourceCommitSha.slice(0, 12)}`,
        files: pendingFiles.map((file) => file.name),
        fileDetails: pendingFiles.map((file) => ({
          path: file.name,
          content: file.content,
          truncated: false,
          language: getPreviewLanguage(file.name),
        })),
        total: pendingFiles.length,
        declaredTotal: stageFiles.length,
        executedTotal: stageFiles.length - pendingFiles.length,
        truncated: false,
        warning: null,
      });
      previousTarget = target ?? previousTarget;
    }
  }

  return previews;
}

async function selectReleaseMigrationSpecs(input: {
  release: ReleasePlanSource;
  sourceCommitSha: string;
  serviceIds: string[];
}): Promise<ResolvedMigrationSpec[]> {
  const specs = await syncMigrationSpecificationsFromRepo(
    input.release.projectId,
    input.release.environmentId,
    {
      sourceRef: input.release.sourceRef,
      sourceCommitSha: input.sourceCommitSha,
    }
  );
  const selected: ResolvedMigrationSpec[] = [];
  const stateByDatabase = new Map<
    string,
    Awaited<ReturnType<typeof getEnvironmentSchemaStateRevision>>
  >();

  for (const spec of specs) {
    if (spec.specification.phase === 'manual' || !input.serviceIds.includes(spec.service.id)) {
      continue;
    }
    let state = stateByDatabase.get(spec.database.id);
    if (state === undefined) {
      state = await getEnvironmentSchemaStateRevision(input.release.projectId, spec.database.id, {
        sourceRef: input.release.sourceRef,
        sourceCommitSha: input.sourceCommitSha,
      });
      stateByDatabase.set(spec.database.id, state);
    }
    if (
      !state ||
      !isSchemaStateForRequestedRevision(state, {
        sourceRef: input.release.sourceRef,
        sourceCommitSha: input.sourceCommitSha,
      })
    ) {
      throw new ReleaseMigrationPlanError(
        `${spec.database.name} 尚未有当前 commit 的 schema 检查结果`
      );
    }
    if (state.status === 'pending_migrations') {
      selected.push(spec);
    }
  }

  return selected.sort(
    (left, right) => left.specification.stageOrder - right.specification.stageOrder
  );
}

export async function ensureReleaseMigrationPlan(input: {
  release: ReleasePlanSource;
  serviceIds: string[];
}) {
  const existing = await db.query.releaseMigrationPlans.findFirst({
    where: eq(releaseMigrationPlans.releaseId, input.release.id),
  });
  if (existing) return existing;

  const sourceCommitSha = requireImmutableCommit(input.release);
  const specs = await selectReleaseMigrationSpecs({
    release: input.release,
    sourceCommitSha,
    serviceIds: input.serviceIds,
  });
  if (specs.length === 0) return null;

  const atlasSpecs = specs.filter((spec) => spec.specification.tool === 'atlas');
  const atlasPreviews = await buildAtlasStagePreviews(atlasSpecs, sourceCommitSha);
  const stages: ReleaseMigrationPlanStageSnapshot[] = [];

  for (const spec of specs) {
    const filePreview =
      spec.specification.tool === 'atlas'
        ? atlasPreviews.get(spec.specification.id)
        : await buildStandardStagePreview(spec, sourceCommitSha, input.release.sourceRef);
    if (!filePreview) {
      throw new ReleaseMigrationPlanError(
        `${spec.service.name}/${spec.database.name} 未生成迁移内容快照`
      );
    }
    stages.push({
      stageKey: [
        spec.specification.id,
        spec.service.id,
        spec.database.id,
        spec.specification.releaseStage,
      ].join(':'),
      specificationId: spec.specification.id,
      serviceId: spec.service.id,
      serviceName: spec.service.name,
      databaseId: spec.database.id,
      databaseName: spec.database.name,
      databaseType: spec.database.type,
      phase: spec.specification.phase as 'preDeploy' | 'postDeploy',
      specification: createMigrationSpecificationSnapshot(spec.specification),
      filePreview,
    });
  }

  for (const databaseId of new Set(stages.map((stage) => stage.databaseId))) {
    const databaseStages = stages.filter((stage) => stage.databaseId === databaseId);
    if (databaseStages.every((stage) => stage.filePreview.total === 0)) {
      throw new ReleaseMigrationPlanError(
        `${databaseStages[0]?.databaseName ?? '数据库'} 被判定存在待迁移变更，但计划中没有任何可执行内容`
      );
    }
  }

  const snapshot: ReleaseMigrationPlanSnapshot = {
    version: 1,
    releaseId: input.release.id,
    projectId: input.release.projectId,
    environmentId: input.release.environmentId,
    sourceRepository: input.release.sourceRepository,
    sourceRef: input.release.sourceRef,
    sourceCommitSha,
    stages,
  };
  const digest = computeReleaseMigrationPlanDigest(snapshot);
  const requiresApproval = stages.some(
    (stage) =>
      stage.specification.executionMode === 'manual_platform' ||
      (input.release.environment.isProduction &&
        (stage.specification.approvalPolicy === 'manual_in_production' ||
          stage.specification.compatibility === 'breaking'))
  );

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(releaseMigrationPlans)
      .values({
        releaseId: input.release.id,
        projectId: input.release.projectId,
        environmentId: input.release.environmentId,
        sourceCommitSha,
        digest,
        snapshot,
        status: requiresApproval ? 'awaiting_approval' : 'approved',
        requiresApproval,
        approvedDigest: requiresApproval ? null : digest,
      })
      .onConflictDoNothing({ target: releaseMigrationPlans.releaseId })
      .returning();
    if (!created) {
      const concurrent = await tx.query.releaseMigrationPlans.findFirst({
        where: eq(releaseMigrationPlans.releaseId, input.release.id),
      });
      if (!concurrent) throw new ReleaseMigrationPlanError('并发创建迁移计划失败');
      return concurrent;
    }

    const runRecords: Array<typeof migrationRuns.$inferInsert> = stages.map((stage) => ({
      id: randomUUID(),
      projectId: input.release.projectId,
      serviceId: stage.serviceId,
      environmentId: input.release.environmentId,
      databaseId: stage.databaseId,
      specificationId: stage.specificationId,
      releaseId: input.release.id,
      releaseMigrationPlanId: created.id,
      triggeredBy: 'deploy',
      sourceCommitSha,
      releaseStage: stage.specification.releaseStage,
      stageOrder: stage.specification.stageOrder,
      targetVersion: stage.specification.targetVersion,
      baselineVersion: stage.specification.baselineVersion,
      specificationSnapshot: stage.specification,
      status:
        stage.specification.executionMode === 'external'
          ? 'awaiting_external_completion'
          : 'queued',
      runnerType: stage.specification.executionMode === 'external' ? 'external' : 'schema_runner',
      lockKey: buildMigrationExecutionKey(input.release.environmentId, stage.databaseId),
      filePreview: stage.filePreview,
    }));
    await tx.insert(migrationRuns).values(runRecords);
    return created;
  });
}

export function assertReleaseMigrationPlanIntegrity(input: {
  digest: string;
  approvedDigest: string | null;
  status: string;
  sourceCommitSha: string;
  snapshot: ReleaseMigrationPlanSnapshot;
  releaseSourceCommitSha: string | null;
}): void {
  const computed = computeReleaseMigrationPlanDigest(input.snapshot);
  if (computed !== input.digest) {
    throw new ReleaseMigrationPlanError('迁移计划摘要校验失败，发布已阻断');
  }
  if (input.status !== 'approved' && input.status !== 'executing') {
    throw new ReleaseMigrationPlanError('迁移计划尚未审批，不能执行');
  }
  if (input.approvedDigest !== input.digest) {
    throw new ReleaseMigrationPlanError('审批摘要与迁移计划不一致，发布已阻断');
  }
  if (
    input.snapshot.sourceCommitSha !== input.sourceCommitSha ||
    input.releaseSourceCommitSha !== input.sourceCommitSha
  ) {
    throw new ReleaseMigrationPlanError('发布 commit 与审批计划不一致，发布已阻断');
  }
}

export async function verifyReleaseMigrationPlanForRun(runId: string): Promise<void> {
  const run = await db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
    with: { releaseMigrationPlan: true, release: true },
  });
  if (!run?.releaseMigrationPlanId || !run.releaseMigrationPlan || !run.release) {
    throw new ReleaseMigrationPlanError('发布迁移 run 未绑定迁移计划');
  }
  assertReleaseMigrationPlanIntegrity({
    ...run.releaseMigrationPlan,
    releaseSourceCommitSha: run.release.configCommitSha ?? run.release.sourceCommitSha,
  });
  const stage = run.releaseMigrationPlan.snapshot.stages.find(
    (item) =>
      item.specificationId === run.specificationId &&
      item.serviceId === run.serviceId &&
      item.databaseId === run.databaseId &&
      item.specification.releaseStage === run.releaseStage
  );
  if (
    !stage ||
    stableSerialize(stage.specification) !== stableSerialize(run.specificationSnapshot) ||
    stableSerialize(stage.filePreview) !== stableSerialize(run.filePreview)
  ) {
    throw new ReleaseMigrationPlanError('迁移 run 与审批计划不一致，发布已阻断');
  }
  await db
    .update(releaseMigrationPlans)
    .set({ status: 'executing', updatedAt: new Date() })
    .where(
      and(
        eq(releaseMigrationPlans.id, run.releaseMigrationPlan.id),
        eq(releaseMigrationPlans.status, 'approved')
      )
    );
}

export async function approveReleaseMigrationPlan(input: {
  planId: string;
  projectId: string;
  actorUserId: string;
  digest: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const plan = await tx.query.releaseMigrationPlans.findFirst({
      where: and(
        eq(releaseMigrationPlans.id, input.planId),
        eq(releaseMigrationPlans.projectId, input.projectId)
      ),
      with: { release: true },
    });
    if (!plan?.release) throw new ReleaseMigrationPlanError('迁移计划不存在');
    if (plan.status !== 'awaiting_approval') {
      throw new ReleaseMigrationPlanError('迁移计划不在待审批状态');
    }
    if (
      input.digest !== plan.digest ||
      computeReleaseMigrationPlanDigest(plan.snapshot) !== plan.digest
    ) {
      throw new ReleaseMigrationPlanError('审批摘要与迁移计划不一致');
    }
    if (
      (plan.release.configCommitSha ?? plan.release.sourceCommitSha) !== plan.sourceCommitSha ||
      plan.snapshot.sourceCommitSha !== plan.sourceCommitSha
    ) {
      throw new ReleaseMigrationPlanError('发布 commit 与迁移计划不一致，不能审批');
    }
    await assertExecutionFence(tx, {
      scopeKey: plan.release.executionKey,
      ownerId: plan.release.id,
      generation: plan.release.executionGeneration,
    });
    const now = new Date();
    const [approved] = await tx
      .update(releaseMigrationPlans)
      .set({
        status: 'approved',
        approvedDigest: plan.digest,
        approvedByUserId: input.actorUserId,
        approvedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(releaseMigrationPlans.id, plan.id),
          eq(releaseMigrationPlans.status, 'awaiting_approval')
        )
      )
      .returning({ id: releaseMigrationPlans.id });
    if (!approved) throw new ReleaseMigrationPlanError('迁移计划已被处理，请刷新页面');
    await tx
      .update(releases)
      .set({ status: 'queued', updatedAt: now })
      .where(eq(releases.id, plan.releaseId));
    await appendReleaseEvent(tx, {
      releaseId: plan.releaseId,
      projectId: plan.projectId,
      environmentId: plan.environmentId,
      actorUserId: input.actorUserId,
      eventKey: `migration-plan-approved:${plan.digest}`,
      type: 'release.approval.received',
      data: { migrationPlanId: plan.id, digest: plan.digest },
      correlationId: plan.releaseId,
      causationId: plan.id,
    });
    await enqueueOutboxMessage(tx, {
      topic: 'release.requested',
      aggregateType: 'release',
      aggregateId: plan.releaseId,
      commandId: `migration-plan-approved-${plan.digest}`,
      payload: {
        traceId: plan.releaseId,
        executionKey: `environment:${plan.environmentId}`,
      },
    });
  });
}

export async function completeReleaseMigrationPlan(releaseId: string): Promise<void> {
  const activeRuns = await db.query.migrationRuns.findMany({
    where: and(
      eq(migrationRuns.releaseId, releaseId),
      inArray(migrationRuns.status, [
        'queued',
        'awaiting_approval',
        'awaiting_external_completion',
        'planning',
        'running',
      ])
    ),
    columns: { id: true },
  });
  if (activeRuns.length > 0) return;
  await db
    .update(releaseMigrationPlans)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(releaseMigrationPlans.releaseId, releaseId));
}
