import type { AIPlugin } from '@/lib/ai/runtime/types';
import { getJuanieSkillById } from '@/lib/ai/skills/registry';
import type { JuanieSkillDefinition } from '@/lib/ai/skills/types';

export function resolvePrimarySkill(
  plugin: AIPlugin<unknown, unknown>
): JuanieSkillDefinition | null {
  const skillId = plugin.manifest.skills[0] ?? null;
  if (!skillId) {
    return null;
  }

  const skill = getJuanieSkillById(skillId);
  if (!skill) {
    throw new Error(`AI plugin ${plugin.manifest.id} references unknown skill ${skillId}`);
  }

  if (!skill.pluginIds.includes(plugin.manifest.id)) {
    throw new Error(`AI plugin ${plugin.manifest.id} is not registered on skill ${skill.id}`);
  }

  if (skill.scope !== plugin.manifest.scope) {
    throw new Error(
      `AI plugin ${plugin.manifest.id} scope ${plugin.manifest.scope} does not match skill ${skill.id}`
    );
  }

  if (skill.outputSchema && skill.outputSchema !== plugin.manifest.snapshotSchema) {
    throw new Error(
      `AI plugin ${plugin.manifest.id} snapshot schema does not match skill ${skill.id}`
    );
  }

  for (const toolId of skill.toolIds) {
    if (!plugin.manifest.tools.includes(toolId)) {
      throw new Error(`AI plugin ${plugin.manifest.id} is missing skill tool ${toolId}`);
    }
  }

  for (const contextProviderId of skill.contextProviderIds) {
    if (!plugin.manifest.contextProviders.includes(contextProviderId)) {
      throw new Error(
        `AI plugin ${plugin.manifest.id} is missing skill context provider ${contextProviderId}`
      );
    }
  }

  return skill;
}
