import type { environments, promotionFlows } from '@/lib/db/schema';
import { isPersistentEnvironment, isProductionEnvironment } from '@/lib/environments/model';

type EnvironmentRecord = typeof environments.$inferSelect;
type PromotionFlowRecord = typeof promotionFlows.$inferSelect;

interface PromotionFlowResolution {
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

function resolveFallbackPromotionSource(
  environments: EnvironmentRecord[]
): EnvironmentRecord | null {
  return (
    environments.find(
      (environment) => isPersistentEnvironment(environment) && environment.autoDeploy
    ) ??
    environments.find(
      (environment) => isPersistentEnvironment(environment) && environment.name === 'staging'
    ) ??
    environments.find((environment) => isPersistentEnvironment(environment)) ??
    null
  );
}

export function resolvePrimaryPromotionFlow(input: {
  environments: EnvironmentRecord[];
  promotionFlows: PromotionFlowRecord[];
}): PromotionFlowResolution {
  const activeFlow =
    [...input.promotionFlows]
      .filter((flow) => flow.isActive)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0] ?? null;

  if (activeFlow) {
    return {
      flow: activeFlow,
      sourceEnvironment: findEnvironmentById(input.environments, activeFlow.sourceEnvironmentId),
      targetEnvironment: findEnvironmentById(input.environments, activeFlow.targetEnvironmentId),
    };
  }

  const targetEnvironment =
    input.environments.find((environment) => isProductionEnvironment(environment)) ?? null;

  return {
    flow: null,
    sourceEnvironment: resolveFallbackPromotionSource(input.environments),
    targetEnvironment,
  };
}
