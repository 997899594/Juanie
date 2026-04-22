import type { JuanieSkillDefinition } from '@/lib/ai/skills/types';

const builtInSkills = [
  {
    id: 'release-skill',
    title: 'Release Skill',
    description: 'Analyze a release with release evidence and structured AI output.',
    scope: 'release',
    pluginIds: ['release-intelligence'],
    toolIds: ['read-release-context'],
    contextProviderIds: ['release-evidence'],
    outputSchema: 'release-plan-v1',
  },
  {
    id: 'incident-skill',
    title: 'Incident Skill',
    description: 'Diagnose a failed or degraded release with incident evidence.',
    scope: 'release',
    pluginIds: ['incident-intelligence'],
    toolIds: ['read-incident-context'],
    contextProviderIds: ['incident-evidence'],
    outputSchema: 'incident-analysis-v1',
  },
  {
    id: 'environment-skill',
    title: 'Environment Skill',
    description: 'Summarize environment health, access URLs, variables, and databases.',
    scope: 'environment',
    pluginIds: ['environment-summary'],
    toolIds: ['read-environment-context', 'read-environment-variables', 'read-environment-schema'],
    contextProviderIds: ['environment-context'],
    outputSchema: 'environment-summary-v1',
  },
  {
    id: 'migration-skill',
    title: 'Migration Skill',
    description: 'Review migration status and recommended next actions.',
    scope: 'environment',
    pluginIds: ['migration-review'],
    toolIds: ['read-environment-migrations', 'read-environment-schema'],
    contextProviderIds: ['environment-migration-review'],
    outputSchema: 'migration-review-v1',
  },
  {
    id: 'envvar-skill',
    title: 'Env Var Skill',
    description: 'Summarize environment variable state and risk.',
    scope: 'environment',
    pluginIds: ['envvar-risk'],
    toolIds: ['read-environment-variables'],
    contextProviderIds: ['environment-envvar-risk'],
    outputSchema: 'envvar-risk-v1',
  },
] satisfies JuanieSkillDefinition[];

export function listJuanieSkills(): JuanieSkillDefinition[] {
  return [...builtInSkills];
}

export function getJuanieSkillById(id: string): JuanieSkillDefinition | null {
  return builtInSkills.find((skill) => skill.id === id) ?? null;
}
