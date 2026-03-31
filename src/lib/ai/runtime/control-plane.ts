import { desc, eq } from 'drizzle-orm';
import { aiProvider } from '@/lib/ai/core/provider';
import { listAIPlugins } from '@/lib/ai/runtime/plugin-registry';
import { db } from '@/lib/db';
import { type AIPlan, aiEntitlements, aiPluginInstallations } from '@/lib/db/schema';

const DEFAULT_PLUGIN_ID = '*';

function normalizePlan(value?: string | null): AIPlan {
  if (value === 'free' || value === 'pro' || value === 'scale' || value === 'enterprise') {
    return value;
  }

  return (process.env.AI_DEFAULT_PLAN as AIPlan | undefined) ?? 'free';
}

function getSurfaceLabel(surface: string): string {
  switch (surface) {
    case 'release':
      return '发布列表';
    case 'release-detail':
      return '发布详情';
    case 'preview':
      return '预览环境';
    case 'project-create':
      return '创建项目';
    case 'environment':
      return '环境页';
    default:
      return surface;
  }
}

function getTierLabel(tier: string): string {
  switch (tier) {
    case 'free':
      return 'Free';
    case 'pro':
      return 'Pro';
    case 'scale':
      return 'Scale';
    case 'enterprise':
      return 'Enterprise';
    default:
      return tier;
  }
}

export interface TeamAIControlPlaneSnapshot {
  provider: ReturnType<typeof aiProvider.getStatus>;
  plan: AIPlan;
  summary: string;
  plugins: Array<{
    id: string;
    name: string;
    surface: string;
    surfaceLabel: string;
    tier: string;
    tierLabel: string;
    enabled: boolean;
    snapshotSchema: string;
    supportsManualRefresh: boolean;
    cacheTtlSeconds: number;
  }>;
}

export async function getTeamAIControlPlane(teamId: string): Promise<TeamAIControlPlaneSnapshot> {
  const [entitlementRows, installationRows] = await Promise.all([
    db.query.aiEntitlements.findMany({
      where: eq(aiEntitlements.teamId, teamId),
      orderBy: [desc(aiEntitlements.updatedAt)],
    }),
    db.query.aiPluginInstallations.findMany({
      where: eq(aiPluginInstallations.teamId, teamId),
      orderBy: [desc(aiPluginInstallations.updatedAt)],
    }),
  ]);

  const defaultEntitlement = entitlementRows.find((row) => row.pluginId === DEFAULT_PLUGIN_ID);
  const installationByPluginId = new Map(installationRows.map((row) => [row.pluginId, row]));
  const plugins = listAIPlugins().map((plugin) => {
    const installation = installationByPluginId.get(plugin.manifest.id);

    return {
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      surface: plugin.manifest.surface,
      surfaceLabel: getSurfaceLabel(plugin.manifest.surface),
      tier: plugin.manifest.tier,
      tierLabel: getTierLabel(plugin.manifest.tier),
      enabled: installation?.isEnabled ?? true,
      snapshotSchema: plugin.manifest.snapshotSchema,
      supportsManualRefresh: plugin.manifest.supportsManualRefresh,
      cacheTtlSeconds: plugin.manifest.cacheTtlSeconds,
    };
  });

  const plan = normalizePlan(defaultEntitlement?.plan);

  return {
    provider: aiProvider.getStatus(),
    plan,
    summary: aiProvider.isEnabled()
      ? `当前团队 AI 套餐为 ${plan}，已接入 ${plugins.length} 个官方插件能力。`
      : '当前 AI provider 未启用，平台会保留插件配置但不会生成新 snapshot。',
    plugins,
  };
}

export async function updateTeamAIControlPlane(input: {
  teamId: string;
  plan: AIPlan;
  plugins: Array<{
    pluginId: string;
    enabled: boolean;
  }>;
}): Promise<TeamAIControlPlaneSnapshot> {
  const now = new Date();

  await db
    .insert(aiEntitlements)
    .values({
      teamId: input.teamId,
      pluginId: DEFAULT_PLUGIN_ID,
      plan: input.plan,
      isEnabled: true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [aiEntitlements.teamId, aiEntitlements.pluginId],
      set: {
        plan: input.plan,
        isEnabled: true,
        updatedAt: now,
      },
    });

  for (const plugin of input.plugins) {
    await db
      .insert(aiPluginInstallations)
      .values({
        teamId: input.teamId,
        pluginId: plugin.pluginId,
        isEnabled: plugin.enabled,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [aiPluginInstallations.teamId, aiPluginInstallations.pluginId],
        set: {
          isEnabled: plugin.enabled,
          updatedAt: now,
        },
      });
  }

  return getTeamAIControlPlane(input.teamId);
}
