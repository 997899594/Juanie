import type { infer as Infer, ZodTypeAny } from 'zod';
import { getJuaniePluginManifestById } from '@/lib/ai/plugins/registry';
import { getPromptVersionedKey } from '@/lib/ai/prompts/registry';
import { getJuanieSkillById } from '@/lib/ai/skills/registry';
import { getJuanieEvalFixtureById, listJuanieEvalFixtures } from './registry';
import type { JuanieEvalFixture } from './types';
import { getWorkflowEvalDefinition, validateWorkflowFixtureOutput } from './workflow-registry';

export interface JuanieEvalResult {
  fixtureId: string;
  ok: boolean;
  checks: Array<{
    label: string;
    ok: boolean;
    detail: string;
  }>;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function buildEvalRuntime<TOutput>(fixture: JuanieEvalFixture<unknown, TOutput>) {
  return {
    async generateObject<TSchema extends ZodTypeAny>(input: {
      schema: TSchema;
      schemaName: string;
      description: string;
      system: string;
      prompt: string;
    }) {
      const parsed = input.schema.parse(fixture.output) as Infer<TSchema>;
      void input.schemaName;
      void input.description;
      void input.system;
      void input.prompt;

      return {
        object: parsed,
        provider: 'eval-fixture',
        model: 'eval-fixture-model',
        usage: null,
      };
    },
  };
}

export async function evaluateJuanieFixture(fixture: JuanieEvalFixture): Promise<JuanieEvalResult> {
  const plugin = getJuaniePluginManifestById(fixture.pluginId);
  const skill = getJuanieSkillById(fixture.skillId);
  const promptVersionedKey = `${fixture.promptKey}@${fixture.promptVersion}`;
  const workflowDefinition = getWorkflowEvalDefinition(fixture.pluginId);
  const checks: JuanieEvalResult['checks'] = [];

  checks.push({
    label: 'plugin registered',
    ok: plugin !== null,
    detail: plugin ? `plugin ${plugin.id} is registered` : `plugin ${fixture.pluginId} is missing`,
  });

  checks.push({
    label: 'skill registered',
    ok: skill !== null,
    detail: skill ? `skill ${skill.id} is registered` : `skill ${fixture.skillId} is missing`,
  });

  checks.push({
    label: 'prompt aligned',
    ok: promptVersionedKey === getPromptVersionedKey(fixture.promptKey as never),
    detail: `fixture prompt ${promptVersionedKey}`,
  });

  checks.push({
    label: 'plugin skill linkage',
    ok: Boolean(
      plugin?.skills.includes(fixture.skillId) && skill?.pluginIds.includes(fixture.pluginId)
    ),
    detail: plugin && skill ? `${plugin.id} <-> ${skill.id}` : 'plugin/skill linkage unavailable',
  });

  checks.push({
    label: 'scope aligned',
    ok: plugin?.scope === fixture.scope && skill?.scope === fixture.scope,
    detail: `fixture scope ${fixture.scope}`,
  });

  checks.push({
    label: 'output schema valid',
    ...validateWorkflowFixtureOutput(fixture),
  });

  checks.push({
    label: 'workflow registered',
    ok: workflowDefinition !== null,
    detail: workflowDefinition
      ? `workflow registered for ${fixture.pluginId}`
      : `workflow missing for ${fixture.pluginId}`,
  });

  if (!workflowDefinition) {
    return {
      fixtureId: fixture.id,
      ok: checks.every((check) => check.ok),
      checks,
    };
  }

  try {
    const execution = await workflowDefinition.run(fixture.input, buildEvalRuntime(fixture));

    checks.push({
      label: 'workflow prompt metadata',
      ok:
        execution.promptKey === fixture.promptKey &&
        execution.promptVersion === fixture.promptVersion &&
        execution.skillId === fixture.skillId,
      detail: `${execution.promptKey ?? 'unknown'}@${execution.promptVersion ?? 'unknown'} via ${execution.skillId ?? 'unknown'}`,
    });

    checks.push({
      label: 'workflow output matches fixture',
      ok: stableStringify(execution.output) === stableStringify(fixture.output),
      detail: 'workflow output matches expected fixture output',
    });
  } catch (error) {
    checks.push({
      label: 'workflow execution',
      ok: false,
      detail: error instanceof Error ? error.message : 'workflow execution failed',
    });
  }

  return {
    fixtureId: fixture.id,
    ok: checks.every((check) => check.ok),
    checks,
  };
}

export async function runJuanieEvals(input?: {
  fixtureId?: string | null;
}): Promise<JuanieEvalResult[]> {
  const fixtures = input?.fixtureId
    ? [getJuanieEvalFixtureById(input.fixtureId)].filter(Boolean)
    : listJuanieEvalFixtures();

  return Promise.all(fixtures.map((fixture) => evaluateJuanieFixture(fixture!)));
}
