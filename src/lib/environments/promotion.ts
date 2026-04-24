import type { environments, promotionFlows } from '@/lib/db/schema';
import { compareEnvironmentDisplayOrder } from '@/lib/environments/model';

type EnvironmentRecord = typeof environments.$inferSelect;
type PromotionFlowRecord = typeof promotionFlows.$inferSelect;

export interface PromotionFlowResolution {
  flow: PromotionFlowRecord | null;
  sourceEnvironment: EnvironmentRecord | null;
  targetEnvironment: EnvironmentRecord | null;
}

function findEnvironmentById(
  environments: EnvironmentRecord[],
  environmentId: string
): EnvironmentRecord | null {
  return environments.find((environment) => environment.id === environmentId) ?? null;
}

function compareResolvedPromotionFlows(
  left: PromotionFlowResolution,
  right: PromotionFlowResolution
): number {
  if (left.sourceEnvironment && right.sourceEnvironment) {
    const sourceOrder = compareEnvironmentDisplayOrder(
      left.sourceEnvironment,
      right.sourceEnvironment
    );
    if (sourceOrder !== 0) {
      return sourceOrder;
    }
  }

  if (left.targetEnvironment && right.targetEnvironment) {
    const targetOrder = compareEnvironmentDisplayOrder(
      left.targetEnvironment,
      right.targetEnvironment
    );
    if (targetOrder !== 0) {
      return targetOrder;
    }
  }

  if (left.flow && right.flow) {
    return left.flow.createdAt.getTime() - right.flow.createdAt.getTime();
  }

  if (left.flow) {
    return -1;
  }

  if (right.flow) {
    return 1;
  }

  return 0;
}

export function resolvePromotionFlows(input: {
  environments: EnvironmentRecord[];
  promotionFlows: PromotionFlowRecord[];
}): PromotionFlowResolution[] {
  const activeFlows = [...input.promotionFlows]
    .filter((flow) => flow.isActive)
    .map((flow) => ({
      flow,
      sourceEnvironment: findEnvironmentById(input.environments, flow.sourceEnvironmentId),
      targetEnvironment: findEnvironmentById(input.environments, flow.targetEnvironmentId),
    }))
    .filter(
      (
        flow
      ): flow is PromotionFlowResolution & {
        flow: PromotionFlowRecord;
        sourceEnvironment: EnvironmentRecord;
        targetEnvironment: EnvironmentRecord;
      } => Boolean(flow.sourceEnvironment && flow.targetEnvironment)
    )
    .sort(compareResolvedPromotionFlows);

  return activeFlows;
}

export function resolvePromotionFlow(input: {
  environments: EnvironmentRecord[];
  promotionFlows: PromotionFlowRecord[];
  flowId?: string | null;
}): PromotionFlowResolution {
  const resolvedFlows = resolvePromotionFlows(input);

  if (input.flowId) {
    return (
      resolvedFlows.find((flow) => flow.flow?.id === input.flowId) ?? {
        flow: null,
        sourceEnvironment: null,
        targetEnvironment: null,
      }
    );
  }

  return (
    resolvedFlows[0] ?? {
      flow: null,
      sourceEnvironment: null,
      targetEnvironment: null,
    }
  );
}

export function resolvePrimaryPromotionFlow(input: {
  environments: EnvironmentRecord[];
  promotionFlows: PromotionFlowRecord[];
}): PromotionFlowResolution {
  return resolvePromotionFlow(input);
}
