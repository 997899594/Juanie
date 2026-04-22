import type { AIPluginManifest } from '@/lib/ai/runtime/types';

export const envvarRiskManifest = {
  id: 'envvar-risk',
  name: 'Env Var Risk',
  title: 'Env Var Risk',
  description:
    'Structured environment variable coverage and risk summary for the current environment scope.',
  version: '1',
  tier: 'pro',
  kind: 'core',
  scope: 'environment',
  surface: 'environment',
  surfaces: ['inline-card', 'action-center'],
  resourceType: 'environment',
  billingMetric: 'per_run',
  snapshotSchema: 'envvar-risk-v1',
  cacheTtlSeconds: 900,
  supportsManualRefresh: true,
  eventTriggers: ['environment.variables.updated', 'environment.updated'],
  capabilities: ['envvar-risk', 'structured-output'],
  skills: ['envvar-skill'],
  tools: ['read-environment-variables'],
  actions: [],
  contextProviders: ['environment-envvar-risk'],
  permissions: {
    level: 'read',
    requiresAudit: true,
  },
} satisfies AIPluginManifest;
