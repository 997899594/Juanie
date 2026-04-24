import type { AIPluginManifest } from '@/lib/ai/runtime/types';
import { releasePlanWorkflowDefinition } from '@/lib/ai/workflows/catalog';

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
  snapshotSchema: releasePlanWorkflowDefinition.snapshotSchema,
  cacheTtlSeconds: 1800,
  supportsManualRefresh: true,
  eventTriggers: ['release.created', 'release.updated', 'release.promote.requested'],
  capabilities: ['release-analysis', 'structured-output'],
  skills: [releasePlanWorkflowDefinition.skillId],
  tools: ['read-release-context'],
  actions: [],
  contextProviders: ['release-evidence'],
  permissions: {
    level: 'read',
    requiresAudit: true,
  },
} satisfies AIPluginManifest;
