import type { AIDegradationState } from '@/lib/ai/core/degradation';

export type AIPluginSurface =
  | 'release'
  | 'release-detail'
  | 'preview'
  | 'project-create'
  | 'environment';

export type AIPluginTier = 'free' | 'pro' | 'scale' | 'enterprise';

export type AIPluginResourceType = 'release' | 'preview' | 'project' | 'environment';

export interface AIPluginManifest {
  id: string;
  name: string;
  version: string;
  tier: AIPluginTier;
  surface: AIPluginSurface;
  resourceType: AIPluginResourceType;
  billingMetric: 'per_team' | 'per_project' | 'per_run';
  snapshotSchema: string;
  cacheTtlSeconds: number;
  supportsManualRefresh: boolean;
  eventTriggers: string[];
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
