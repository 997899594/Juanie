import { desc, eq } from 'drizzle-orm';
import { aiProvider } from '@/lib/ai/core/provider';
import {
  extractDynamicPluginManifestsFromConfig,
  resolveDynamicPluginCatalog,
} from '@/lib/ai/plugins/dynamic-registry';
import { listAIPluginsForTeam } from '@/lib/ai/runtime/plugin-registry';
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
    case 'project':
      return '项目';
    case 'team':
      return '团队';
    default:
      return surface;
  }
}

function getAttachmentLabel(surface: string): string {
  switch (surface) {
    case 'inline-card':
      return '内联卡片';
    case 'action-center':
      return '动作中心';
    case 'task-center':
      return '任务中心';
    case 'copilot-panel':
      return 'Copilot 面板';
    default:
      return surface;
  }
}

function getScopeLabel(scope: string): string {
  switch (scope) {
    case 'team':
      return '团队';
    case 'project':
      return '项目';
    case 'environment':
      return '环境';
    case 'release':
      return '发布';
    default:
      return scope;
  }
}

function getPermissionLabel(level: string): string {
  switch (level) {
    case 'read':
      return '只读';
    case 'write':
      return '写入';
    case 'dangerous':
      return '高风险';
    default:
      return level;
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
    title: string;
    description: string;
    surface: string;
    surfaceLabel: string;
    scope: string;
    scopeLabel: string;
    tier: string;
    tierLabel: string;
    enabled: boolean;
    permissionLevel: string;
    permissionLabel: string;
    requiresAudit: boolean;
    snapshotSchema: string;
    supportsManualRefresh: boolean;
    cacheTtlSeconds: number;
    skills: string[];
    tools: string[];
    actions: string[];
    capabilities: string[];
    contextProviders: string[];
    source: 'built-in' | 'dynamic';
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
  const dynamicManifests = installationRows.flatMap((row) =>
    extractDynamicPluginManifestsFromConfig(row.config)
  );
  const catalog = resolveDynamicPluginCatalog({
    manifests: dynamicManifests,
  });
  const runtimePluginById = new Map(
    (await listAIPluginsForTeam(teamId)).map((plugin) => [plugin.manifest.id, plugin])
  );
  const plugins = catalog.all.map((manifest) => {
    const runtimePlugin = runtimePluginById.get(manifest.id);
    const installation = installationByPluginId.get(manifest.id);

    return {
      id: manifest.id,
      name: runtimePlugin?.manifest.name ?? manifest.title,
      title: runtimePlugin?.manifest.title ?? manifest.title,
      description: runtimePlugin?.manifest.description ?? manifest.description,
      surface: runtimePlugin?.manifest.surface ?? manifest.surfaces[0] ?? manifest.scope,
      surfaceLabel: runtimePlugin
        ? getSurfaceLabel(runtimePlugin.manifest.surface)
        : getAttachmentLabel(manifest.surfaces[0] ?? manifest.scope),
      scope: manifest.scope,
      scopeLabel: getScopeLabel(manifest.scope),
      tier: runtimePlugin?.manifest.tier ?? 'free',
      tierLabel: getTierLabel(runtimePlugin?.manifest.tier ?? 'free'),
      enabled: installation?.isEnabled ?? true,
      permissionLevel: manifest.permissions.level,
      permissionLabel: getPermissionLabel(manifest.permissions.level),
      requiresAudit: manifest.permissions.requiresAudit,
      snapshotSchema: runtimePlugin?.manifest.snapshotSchema ?? 'dynamic-manifest',
      supportsManualRefresh: runtimePlugin?.manifest.supportsManualRefresh ?? false,
      cacheTtlSeconds: runtimePlugin?.manifest.cacheTtlSeconds ?? 0,
      skills: manifest.skills,
      tools: manifest.tools,
      actions: manifest.actions.map((action) => action.title),
      capabilities: manifest.capabilities,
      contextProviders: manifest.contextProviders,
      source: (runtimePlugin ? 'built-in' : 'dynamic') as 'built-in' | 'dynamic',
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
