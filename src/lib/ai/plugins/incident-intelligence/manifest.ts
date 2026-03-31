import type { AIPluginManifest } from '@/lib/ai/runtime/types';

export const incidentIntelligenceManifest = {
  id: 'incident-intelligence',
  name: 'Incident Intelligence',
  version: '1',
  tier: 'scale',
  surface: 'release-detail',
  resourceType: 'release',
  billingMetric: 'per_run',
  snapshotSchema: 'incident-analysis-v1',
  cacheTtlSeconds: 900,
  supportsManualRefresh: true,
  eventTriggers: ['release.failed', 'release.degraded', 'environment.remediation_triggered'],
} satisfies AIPluginManifest;
