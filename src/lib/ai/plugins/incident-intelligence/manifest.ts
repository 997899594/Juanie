import type { AIPluginManifest } from '@/lib/ai/runtime/types';

export const incidentIntelligenceManifest = {
  id: 'incident-intelligence',
  name: 'Incident Intelligence',
  title: 'Incident Intelligence',
  description: 'Structured incident diagnosis for a concrete release.',
  version: '1',
  tier: 'scale',
  kind: 'core',
  scope: 'release',
  surface: 'release-detail',
  surfaces: ['inline-card', 'action-center'],
  resourceType: 'release',
  billingMetric: 'per_run',
  snapshotSchema: 'incident-analysis-v1',
  cacheTtlSeconds: 900,
  supportsManualRefresh: true,
  eventTriggers: ['release.failed', 'release.degraded', 'environment.remediation_triggered'],
  capabilities: ['incident-analysis', 'structured-output'],
  skills: ['incident-skill'],
  tools: ['read-incident-context'],
  actions: [],
  contextProviders: ['incident-evidence'],
  permissions: {
    level: 'read',
    requiresAudit: true,
  },
} satisfies AIPluginManifest;
