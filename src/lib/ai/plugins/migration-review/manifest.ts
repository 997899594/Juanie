import type { AIPluginManifest } from '@/lib/ai/runtime/types';
import { migrationReviewWorkflowDefinition } from '@/lib/ai/workflows/catalog';

export const migrationReviewManifest = {
  id: 'migration-review',
  name: 'Migration Review',
  title: 'Migration Review',
  description: 'Structured migration review for the current environment scope.',
  version: '1',
  tier: 'pro',
  kind: 'core',
  scope: 'environment',
  surface: 'environment',
  surfaces: ['inline-card', 'task-center'],
  resourceType: 'environment',
  billingMetric: 'per_run',
  snapshotSchema: migrationReviewWorkflowDefinition.snapshotSchema,
  cacheTtlSeconds: 900,
  supportsManualRefresh: true,
  eventTriggers: ['migration.updated', 'release.updated', 'schema.updated'],
  capabilities: ['migration-review', 'structured-output'],
  skills: [migrationReviewWorkflowDefinition.skillId],
  tools: ['read-environment-migrations', 'read-environment-schema'],
  actions: [],
  contextProviders: ['environment-migration-review'],
  permissions: {
    level: 'read',
    requiresAudit: true,
  },
} satisfies AIPluginManifest;
