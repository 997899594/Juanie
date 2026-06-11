import type { ProjectPromotionPlanView } from '@/lib/releases/service';

const schemaRefreshSummary = 'Schema 检查刷新中，创建后准入会继续等待检查。';

function isSchemaInspectionMissingState(
  state: ProjectPromotionPlanView['plan']['schema']['states'][number]
) {
  return (
    state.freshness === 'missing' &&
    state.refreshStatus !== 'failed' &&
    state.refreshStatus !== 'unavailable' &&
    (state.status === 'unknown' || state.status === 'blocked')
  );
}

function hasNonSchemaCreationBlocker(plan: ProjectPromotionPlanView): boolean {
  return plan.plan.platformSignals.chips.some(
    (chip) =>
      chip.tone === 'danger' &&
      !chip.key.startsWith('schema:') &&
      !chip.key.startsWith('issue:approval_blocked') &&
      !chip.key.startsWith('release-policy:')
  );
}

export function isPromotionPlanWaitingOnlyOnSchemaInspection(
  plan: ProjectPromotionPlanView | null
): boolean {
  if (!plan) {
    return false;
  }

  const schema = plan.plan.schema;
  const refresh = schema.refresh;
  const missingCount = refresh?.missingCount ?? 0;
  const failedCount = (refresh?.failedCount ?? 0) + (refresh?.unavailableCount ?? 0);

  return (
    failedCount === 0 &&
    missingCount > 0 &&
    schema.states.length > 0 &&
    schema.states.every(isSchemaInspectionMissingState) &&
    !hasNonSchemaCreationBlocker(plan)
  );
}

function upsertSchemaRefreshingChip(
  chips: ProjectPromotionPlanView['plan']['platformSignals']['chips']
): ProjectPromotionPlanView['plan']['platformSignals']['chips'] {
  const nextChips = chips.filter(
    (chip) => chip.key !== 'schema:blocking' && chip.key !== 'schema:blocked'
  );

  if (!nextChips.some((chip) => chip.key === 'schema:refreshing')) {
    nextChips.unshift({
      key: 'schema:refreshing',
      label: 'Schema 刷新中',
      tone: 'neutral',
    });
  }

  return nextChips;
}

export function markPromotionPlanSchemaRefreshQueued<T extends ProjectPromotionPlanView>(
  plan: T | null
): T | null {
  if (!plan || !isPromotionPlanWaitingOnlyOnSchemaInspection(plan)) {
    return plan;
  }

  const schema = plan.plan.schema;
  const missingCount = Math.max(
    schema.refresh?.missingCount ?? 0,
    schema.states.filter(isSchemaInspectionMissingState).length
  );
  const queuedCount = Math.max(
    schema.refresh?.queuedCount ?? 0,
    schema.refresh?.runningCount ?? 0,
    1
  );

  return {
    ...plan,
    plan: {
      ...plan.plan,
      canCreate: true,
      blockingReason: null,
      summary:
        plan.plan.summary === plan.plan.blockingReason ? schemaRefreshSummary : plan.plan.summary,
      platformSignals: {
        ...plan.plan.platformSignals,
        chips: upsertSchemaRefreshingChip(plan.plan.platformSignals.chips),
        primarySummary: schemaRefreshSummary,
        nextActionLabel: '等待 Schema 检查完成',
      },
      schema: {
        ...schema,
        blockingCount: 0,
        summary: null,
        nextActionLabel: '等待 Schema 检查完成',
        refresh: {
          requested: true,
          queuedCount,
          runningCount: schema.refresh?.runningCount ?? 0,
          unavailableCount: 0,
          failedCount: 0,
          missingCount,
        },
        states: schema.states.map((state) =>
          isSchemaInspectionMissingState(state)
            ? {
                ...state,
                status: 'unknown',
                statusLabel: '待检查',
                refreshStatus: state.refreshStatus === 'running' ? 'running' : 'queued',
              }
            : state
        ),
      },
    },
  };
}
