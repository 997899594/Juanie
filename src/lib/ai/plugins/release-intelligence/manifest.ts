import type { AIPluginManifest } from '@/lib/ai/runtime/types';

export const releaseIntelligenceManifest = {
  id: 'release-intelligence',
  name: 'Release Intelligence',
  version: '1',
  tier: 'pro',
  surface: 'release',
  resourceType: 'release',
  billingMetric: 'per_run',
  snapshotSchema: 'release-plan-v1',
  cacheTtlSeconds: 1800,
  supportsManualRefresh: true,
  eventTriggers: ['release.created', 'release.updated', 'release.promote.requested'],
} satisfies AIPluginManifest;
