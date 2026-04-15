import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import {
  type DeliveryRuleKind,
  deliveryRules,
  environments,
  type PromotionFlowStrategy,
  promotionFlows,
} from '@/lib/db/schema';
import { canEditDeliveryControl } from '@/lib/environments/control-plane';

const deliveryRuleKinds: [DeliveryRuleKind, ...DeliveryRuleKind[]] = [
  'branch',
  'tag',
  'pull_request',
  'manual',
];
const promotionFlowStrategies: [PromotionFlowStrategy, ...PromotionFlowStrategy[]] = [
  'reuse_release_artifacts',
  'rebuild_from_ref',
];

const updateDeliveryControlSchema = z.object({
  routingRules: z.array(
    z.object({
      id: z.string().uuid().optional(),
      environmentId: z.string().uuid(),
      kind: z.enum(deliveryRuleKinds),
      pattern: z.string().trim().max(255).nullable(),
      priority: z.number().int().min(0).max(10000),
      isActive: z.boolean(),
      autoCreateEnvironment: z.boolean(),
    })
  ),
  promotionFlows: z.array(
    z.object({
      id: z.string().uuid().optional(),
      sourceEnvironmentId: z.string().uuid(),
      targetEnvironmentId: z.string().uuid(),
      requiresApproval: z.boolean(),
      strategy: z.enum(promotionFlowStrategies),
      isActive: z.boolean(),
    })
  ),
});

function validateRoutingRules(
  environmentIds: Set<string>,
  rules: Array<{
    id?: string;
    environmentId: string;
    kind: DeliveryRuleKind;
    pattern: string | null;
    priority: number;
    isActive: boolean;
    autoCreateEnvironment: boolean;
  }>
): string | null {
  for (const rule of rules) {
    if (!environmentIds.has(rule.environmentId)) {
      return '存在不属于当前项目的路由目标环境';
    }

    if (rule.kind === 'manual') {
      continue;
    }

    if (!rule.pattern?.trim()) {
      return '分支、标签和 PR 路由都需要 pattern';
    }

    if (rule.kind === 'pull_request' && !rule.autoCreateEnvironment) {
      return 'PR 路由必须启用自动创建环境';
    }
  }

  return null;
}

function validatePromotionFlows(
  environmentIds: Set<string>,
  flows: Array<{
    sourceEnvironmentId: string;
    targetEnvironmentId: string;
  }>
): string | null {
  const pairSet = new Set<string>();

  for (const flow of flows) {
    if (
      !environmentIds.has(flow.sourceEnvironmentId) ||
      !environmentIds.has(flow.targetEnvironmentId)
    ) {
      return '存在不属于当前项目的推广环境';
    }

    if (flow.sourceEnvironmentId === flow.targetEnvironmentId) {
      return '推广链路的源环境和目标环境不能相同';
    }

    const pairKey = `${flow.sourceEnvironmentId}:${flow.targetEnvironmentId}`;
    if (pairSet.has(pairKey)) {
      return '不能重复配置相同的推广链路';
    }
    pairSet.add(pairKey);
  }

  return null;
}

export async function PATCH(request: Request, context: { params: Promise<unknown> }) {
  try {
    const resolvedParams = await context.params;
    const id =
      typeof resolvedParams === 'object' &&
      resolvedParams !== null &&
      'id' in resolvedParams &&
      typeof resolvedParams.id === 'string'
        ? resolvedParams.id
        : null;

    if (!id) {
      return NextResponse.json({ error: '无效的项目 ID' }, { status: 400 });
    }
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(id, session.user.id);

    if (!canEditDeliveryControl(member.role)) {
      return NextResponse.json({ error: '只有 owner 或 admin 可以修改交付链路' }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = updateDeliveryControlSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: '交付链路配置无效' }, { status: 400 });
    }

    const environmentList = await db.query.environments.findMany({
      where: eq(environments.projectId, id),
      columns: {
        id: true,
      },
    });
    const environmentIds = new Set(environmentList.map((environment) => environment.id));

    const routingValidationError = validateRoutingRules(environmentIds, parsed.data.routingRules);
    if (routingValidationError) {
      return NextResponse.json({ error: routingValidationError }, { status: 400 });
    }

    const promotionValidationError = validatePromotionFlows(
      environmentIds,
      parsed.data.promotionFlows
    );
    if (promotionValidationError) {
      return NextResponse.json({ error: promotionValidationError }, { status: 400 });
    }

    const existingRules = await db.query.deliveryRules.findMany({
      where: eq(deliveryRules.projectId, id),
      columns: {
        id: true,
      },
    });
    const existingFlows = await db.query.promotionFlows.findMany({
      where: eq(promotionFlows.projectId, id),
      columns: {
        id: true,
      },
    });

    await db.transaction(async (tx) => {
      const now = new Date();
      const incomingRuleIds = new Set(
        parsed.data.routingRules.map((rule) => rule.id).filter(Boolean)
      );
      const incomingFlowIds = new Set(
        parsed.data.promotionFlows.map((flow) => flow.id).filter(Boolean)
      );
      const ruleIdsToDelete = existingRules
        .map((rule) => rule.id)
        .filter((ruleId) => !incomingRuleIds.has(ruleId));
      const flowIdsToDelete = existingFlows
        .map((flow) => flow.id)
        .filter((flowId) => !incomingFlowIds.has(flowId));

      if (ruleIdsToDelete.length > 0) {
        await tx
          .delete(deliveryRules)
          .where(and(eq(deliveryRules.projectId, id), inArray(deliveryRules.id, ruleIdsToDelete)));
      }

      if (flowIdsToDelete.length > 0) {
        await tx
          .delete(promotionFlows)
          .where(
            and(eq(promotionFlows.projectId, id), inArray(promotionFlows.id, flowIdsToDelete))
          );
      }

      for (const rule of parsed.data.routingRules) {
        if (rule.id) {
          await tx
            .update(deliveryRules)
            .set({
              environmentId: rule.environmentId,
              kind: rule.kind,
              pattern: rule.pattern,
              priority: rule.priority,
              isActive: rule.isActive,
              autoCreateEnvironment: rule.autoCreateEnvironment,
              updatedAt: now,
            })
            .where(and(eq(deliveryRules.id, rule.id), eq(deliveryRules.projectId, id)));
          continue;
        }

        await tx.insert(deliveryRules).values({
          projectId: id,
          environmentId: rule.environmentId,
          kind: rule.kind,
          pattern: rule.pattern,
          priority: rule.priority,
          isActive: rule.isActive,
          autoCreateEnvironment: rule.autoCreateEnvironment,
          updatedAt: now,
        });
      }

      for (const flow of parsed.data.promotionFlows) {
        if (flow.id) {
          await tx
            .update(promotionFlows)
            .set({
              sourceEnvironmentId: flow.sourceEnvironmentId,
              targetEnvironmentId: flow.targetEnvironmentId,
              requiresApproval: flow.requiresApproval,
              strategy: flow.strategy,
              isActive: flow.isActive,
              updatedAt: now,
            })
            .where(and(eq(promotionFlows.id, flow.id), eq(promotionFlows.projectId, id)));
          continue;
        }

        await tx.insert(promotionFlows).values({
          projectId: id,
          sourceEnvironmentId: flow.sourceEnvironmentId,
          targetEnvironmentId: flow.targetEnvironmentId,
          requiresApproval: flow.requiresApproval,
          strategy: flow.strategy,
          isActive: flow.isActive,
          updatedAt: now,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
