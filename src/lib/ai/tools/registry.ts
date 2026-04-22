import type { JuanieToolDefinition } from '@/lib/ai/tools/types';

const builtInTools = [
  {
    id: 'read-environment-context',
    title: 'Read Environment Context',
    auditLabel: 'ai.read_environment_context',
    description:
      'Load environment-level state, domains, latest release, database bindings, and policy.',
    scope: 'environment',
    riskLevel: 'read',
    requiresAudit: true,
  },
  {
    id: 'read-environment-variables',
    title: 'Read Environment Variables',
    auditLabel: 'ai.read_environment_variables',
    description:
      'Inspect environment variables, inheritance chain, secrets coverage, and service overrides.',
    scope: 'environment',
    riskLevel: 'read',
    requiresAudit: true,
  },
  {
    id: 'read-environment-migrations',
    title: 'Read Environment Migrations',
    auditLabel: 'ai.read_environment_migrations',
    description:
      'Inspect migration runs, approval state, external completion, and failure status for an environment.',
    scope: 'environment',
    riskLevel: 'read',
    requiresAudit: true,
  },
  {
    id: 'read-environment-schema',
    title: 'Read Environment Schema',
    auditLabel: 'ai.read_environment_schema',
    description:
      'Inspect schema state, repair plans, and Atlas diff status for environment databases.',
    scope: 'environment',
    riskLevel: 'read',
    requiresAudit: true,
  },
  {
    id: 'approve-migration-run',
    title: 'Approve Migration Run',
    auditLabel: 'ai.approve_migration_run',
    description:
      'Approve an environment migration run that is currently waiting for manual approval.',
    scope: 'environment',
    riskLevel: 'write',
    requiresAudit: true,
    requiresReason: true,
    requiresApprovalToken: true,
  },
  {
    id: 'read-release-context',
    title: 'Read Release Context',
    auditLabel: 'ai.read_release_context',
    description: 'Inspect release facts, artifacts, lifecycle state, and rollout diagnostics.',
    scope: 'release',
    riskLevel: 'read',
    requiresAudit: true,
  },
  {
    id: 'read-incident-context',
    title: 'Read Incident Context',
    auditLabel: 'ai.read_incident_context',
    description: 'Inspect failed or degraded release evidence and platform incident signals.',
    scope: 'release',
    riskLevel: 'read',
    requiresAudit: true,
  },
] satisfies JuanieToolDefinition[];

export function listJuanieTools(): JuanieToolDefinition[] {
  return [...builtInTools];
}

export function getJuanieToolById(id: string): JuanieToolDefinition | null {
  return builtInTools.find((tool) => tool.id === id) ?? null;
}
