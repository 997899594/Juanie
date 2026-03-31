import { and, desc, eq } from 'drizzle-orm';
import { aiProvider } from '@/lib/ai/core/provider';
import type { AIPluginTier } from '@/lib/ai/runtime/types';
import { db } from '@/lib/db';
import { type AIPlan, aiEntitlements, aiPluginInstallations } from '@/lib/db/schema';

export type { AIPlan } from '@/lib/db/schema';

const PLAN_RANK: Record<AIPlan, number> = {
  free: 0,
  pro: 1,
  scale: 2,
  enterprise: 3,
};

const TIER_RANK: Record<AIPluginTier, number> = {
  free: 0,
  pro: 1,
  scale: 2,
  enterprise: 3,
};

const DEFAULT_PLUGIN_ID = '*';

function isCurrentEntitlementWindow(input: {
  startsAt?: Date | null;
  endsAt?: Date | null;
}): boolean {
  const now = Date.now();
  const startsAt = input.startsAt ? new Date(input.startsAt).getTime() : null;
  const endsAt = input.endsAt ? new Date(input.endsAt).getTime() : null;

  if (startsAt && startsAt > now) {
    return false;
  }

  if (endsAt && endsAt < now) {
    return false;
  }

  return true;
}

function normalizeDefaultPlan(value?: string | null): AIPlan {
  if (value === 'free' || value === 'pro' || value === 'scale' || value === 'enterprise') {
    return value;
  }

  return 'free';
}

export function isPluginTierAllowed(plan: AIPlan, requiredTier: AIPluginTier): boolean {
  return PLAN_RANK[plan] >= TIER_RANK[requiredTier];
}

export function getPluginEntitlementSummary(
  plan: AIPlan,
  requiredTier: AIPluginTier
): string | null {
  if (isPluginTierAllowed(plan, requiredTier)) {
    return null;
  }

  return `当前套餐为 ${plan}，需要 ${requiredTier} 才能启用该 AI 插件`;
}

export async function getTeamAIPlan(teamId: string, pluginId?: string): Promise<AIPlan> {
  const entitlementRows = await db.query.aiEntitlements.findMany({
    where: eq(aiEntitlements.teamId, teamId),
    orderBy: [desc(aiEntitlements.updatedAt), desc(aiEntitlements.createdAt)],
  });

  const activeRows = entitlementRows.filter((row) => isCurrentEntitlementWindow(row));
  const pluginRow = pluginId
    ? activeRows.find((row) => row.pluginId === pluginId && row.isEnabled)
    : null;

  if (pluginRow) {
    return pluginRow.plan;
  }

  const defaultRow = activeRows.find((row) => row.pluginId === DEFAULT_PLUGIN_ID && row.isEnabled);
  if (defaultRow) {
    return defaultRow.plan;
  }

  return normalizeDefaultPlan(process.env.AI_DEFAULT_PLAN);
}

export async function isAIPluginEnabledForTeam(input: {
  teamId: string;
  pluginId: string;
}): Promise<boolean> {
  const installation = await db.query.aiPluginInstallations.findFirst({
    where: and(
      eq(aiPluginInstallations.teamId, input.teamId),
      eq(aiPluginInstallations.pluginId, input.pluginId)
    ),
    orderBy: [desc(aiPluginInstallations.updatedAt)],
  });

  return installation ? installation.isEnabled : true;
}

export interface AIPluginAvailability {
  enabled: boolean;
  providerEnabled: boolean;
  pluginEnabled: boolean;
  plan: AIPlan;
  requiredTier: AIPluginTier;
  blockedReason: string | null;
}

export async function getAIPluginAvailability(input: {
  teamId: string;
  pluginId: string;
  requiredTier: AIPluginTier;
}): Promise<AIPluginAvailability> {
  const [plan, pluginEnabled] = await Promise.all([
    getTeamAIPlan(input.teamId, input.pluginId),
    isAIPluginEnabledForTeam({
      teamId: input.teamId,
      pluginId: input.pluginId,
    }),
  ]);
  const providerEnabled = aiProvider.isEnabled();

  let blockedReason: string | null = null;
  if (!pluginEnabled) {
    blockedReason = '当前团队已禁用该 AI 插件';
  } else if (!providerEnabled) {
    blockedReason = 'AI provider 当前未启用或未配置';
  } else {
    blockedReason = getPluginEntitlementSummary(plan, input.requiredTier);
  }

  return {
    enabled: blockedReason === null,
    providerEnabled,
    pluginEnabled,
    plan,
    requiredTier: input.requiredTier,
    blockedReason,
  };
}
