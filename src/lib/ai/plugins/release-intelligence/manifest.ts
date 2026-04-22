import type { AIPluginManifest } from '@/lib/ai/runtime/types';

export const releaseIntelligenceManifest = {
  id: 'release-intelligence',
  name: 'Release Intelligence',
  title: 'Release Intelligence',
  description: 'Structured release analysis for a concrete release.',
  version: '1',
  tier: 'pro',
  kind: 'core',
  scope: 'release',
  surface: 'release',
  surfaces: ['inline-card', 'action-center'],
  resourceType: 'release',
  billingMetric: 'per_run',
  snapshotSchema: 'release-plan-v1',
  cacheTtlSeconds: 1800,
  supportsManualRefresh: true,
  eventTriggers: ['release.created', 'release.updated', 'release.promote.requested'],
  capabilities: ['release-analysis', 'structured-output'],
  skills: ['release-skill'],
  tools: ['read-release-context'],
  actions: [],
  contextProviders: ['release-evidence'],
  permissions: {
    level: 'read',
    requiresAudit: true,
  },
} satisfies AIPluginManifest;
