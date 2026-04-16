import type { deliveryRules, environments, promotionFlows, TeamRole } from '@/lib/db/schema';
import {
  compareEnvironmentDisplayOrder,
  getEnvironmentDeliveryMode,
  getEnvironmentKind,
  isPreviewEnvironment,
} from '@/lib/environments/model';
import {
  getEnvironmentScopeLabel,
  getEnvironmentSourceLabel,
} from '@/lib/environments/presentation';

type EnvironmentRecord = typeof environments.$inferSelect;
type DeliveryRuleRecord = typeof deliveryRules.$inferSelect;
type PromotionFlowRecord = typeof promotionFlows.$inferSelect;

export interface DeliveryControlSnapshot {
  editable: boolean;
  editSummary: string;
  environments: Array<{
    id: string;
    name: string;
    kind: ReturnType<typeof getEnvironmentKind>;
    deliveryMode: ReturnType<typeof getEnvironmentDeliveryMode>;
    scopeLabel: string | null;
    sourceLabel: string | null;
  }>;
  routingRules: Array<{
    id: string;
    environmentId: string | null;
    environmentName: string | null;
    kind: DeliveryRuleRecord['kind'];
    pattern: string | null;
    priority: number;
    isActive: boolean;
    autoCreateEnvironment: boolean;
  }>;
  promotionFlows: Array<{
    id: string;
    sourceEnvironmentId: string;
    sourceEnvironmentName: string;
    targetEnvironmentId: string;
    targetEnvironmentName: string;
    requiresApproval: boolean;
    strategy: PromotionFlowRecord['strategy'];
    isActive: boolean;
  }>;
}

export function canEditDeliveryControl(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function buildDeliveryControlSnapshot(input: {
  role: TeamRole;
  environments: EnvironmentRecord[];
  deliveryRules: DeliveryRuleRecord[];
  promotionFlows: PromotionFlowRecord[];
}): DeliveryControlSnapshot {
  const environmentById = new Map(
    input.environments.map((environment) => [environment.id, environment])
  );
  const orderedEnvironments = [...input.environments].sort(compareEnvironmentDisplayOrder);

  return {
    editable: canEditDeliveryControl(input.role),
    editSummary: canEditDeliveryControl(input.role)
      ? '可修改 Git 路由和环境推广链路'
      : '只有 owner 或 admin 可以修改交付链路',
    environments: orderedEnvironments
      .filter((environment) => !isPreviewEnvironment(environment))
      .map((environment) => ({
        id: environment.id,
        name: environment.name,
        kind: getEnvironmentKind(environment),
        deliveryMode: getEnvironmentDeliveryMode(environment),
        scopeLabel: getEnvironmentScopeLabel(environment),
        sourceLabel: getEnvironmentSourceLabel(environment),
      })),
    routingRules: [...input.deliveryRules]
      .sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority - right.priority;
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
      })
      .map((rule) => ({
        id: rule.id,
        environmentId: rule.environmentId ?? null,
        environmentName: rule.environmentId
          ? (environmentById.get(rule.environmentId)?.name ?? null)
          : null,
        kind: rule.kind,
        pattern: rule.pattern ?? null,
        priority: rule.priority,
        isActive: rule.isActive,
        autoCreateEnvironment: rule.autoCreateEnvironment,
      })),
    promotionFlows: [...input.promotionFlows]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((flow) => ({
        id: flow.id,
        sourceEnvironmentId: flow.sourceEnvironmentId,
        sourceEnvironmentName: environmentById.get(flow.sourceEnvironmentId)?.name ?? '未命名环境',
        targetEnvironmentId: flow.targetEnvironmentId,
        targetEnvironmentName: environmentById.get(flow.targetEnvironmentId)?.name ?? '未命名环境',
        requiresApproval: flow.requiresApproval,
        strategy: flow.strategy,
        isActive: flow.isActive,
      })),
  };
}
