import type { AIPluginManifest } from '@/lib/ai/runtime/types';
import { environmentSummaryWorkflowDefinition } from '@/lib/ai/workflows/catalog';

export const environmentSummaryManifest = {
  id: 'environment-summary',
  name: 'Environment Summary',
  title: 'Environment Summary',
  description: 'Structured environment summary for the current environment scope.',
  version: '1',
  tier: 'free',
  kind: 'core',
  scope: 'environment',
  surface: 'environment',
  surfaces: ['inline-card', 'action-center'],
  resourceType: 'environment',
  billingMetric: 'per_run',
  snapshotSchema: environmentSummaryWorkflowDefinition.snapshotSchema,
  cacheTtlSeconds: 900,
  supportsManualRefresh: true,
  eventTriggers: ['environment.updated', 'release.updated', 'environment.variables.updated'],
  capabilities: ['environment-summary', 'structured-output'],
  skills: [environmentSummaryWorkflowDefinition.skillId],
  tools: ['read-environment-context', 'read-environment-variables', 'read-environment-schema'],
  actions: [],
  contextProviders: ['environment-context'],
  permissions: {
    level: 'read',
    requiresAudit: true,
  },
} satisfies AIPluginManifest;
