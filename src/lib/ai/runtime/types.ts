import type { AIDegradationState } from '@/lib/ai/core/degradation';

export type AIPluginSurface =
  | 'release'
  | 'release-detail'
  | 'preview'
  | 'project-create'
  | 'environment'
  | 'project'
  | 'team';

export type AIPluginTier = 'free' | 'pro' | 'scale' | 'enterprise';

export type AIPluginResourceType = 'release' | 'preview' | 'project' | 'environment' | 'team';

export type AIPluginKind = 'core' | 'workspace' | 'external' | 'mcp';

export type AIPluginScope = 'global' | 'team' | 'project' | 'environment' | 'release';

export type AIPluginPermissionLevel = 'read' | 'write' | 'dangerous';

export interface AIPluginActionDefinition {
  id: string;
  title: string;
  description: string;
  toolId: string;
  surface: 'action-center' | 'task-center';
  reason: string;
  requiresConfirmation: boolean;
}

export interface AIPluginManifest {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  tier: AIPluginTier;
  kind: AIPluginKind;
  scope: AIPluginScope;
  surface: AIPluginSurface;
  surfaces: Array<'copilot-panel' | 'inline-card' | 'action-center' | 'task-center'>;
  resourceType: AIPluginResourceType;
  billingMetric: 'per_team' | 'per_project' | 'per_run';
  snapshotSchema: string;
  cacheTtlSeconds: number;
  supportsManualRefresh: boolean;
  eventTriggers: string[];
  capabilities: string[];
  skills: string[];
  tools: string[];
  actions: AIPluginActionDefinition[];
  contextProviders: string[];
  permissions: {
    level: AIPluginPermissionLevel;
    requiresAudit: boolean;
  };
}

export interface AIPluginContext {
  teamId: string;
  projectId?: string;
  environmentId?: string;
  releaseId?: string;
  previewEnvironmentId?: string;
  actorUserId?: string | null;
}

export interface AIPluginRunEnvelope<TOutput> {
  output: TOutput;
  provider: string | null;
  model: string | null;
  degradation: AIDegradationState;
  skillId?: string | null;
  promptKey?: string | null;
  promptVersion?: string | null;
  outputSchema?: string | null;
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  } | null;
}

export interface AIPlugin<TEvidence, TOutput> {
  manifest: AIPluginManifest;
  isEnabled(context: AIPluginContext): Promise<boolean>;
  buildEvidence(context: AIPluginContext): Promise<TEvidence>;
  run(args: {
    context: AIPluginContext;
    evidence: TEvidence;
  }): Promise<AIPluginRunEnvelope<TOutput>>;
}
