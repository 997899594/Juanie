import { z } from 'zod';
import { loadMarkdownAsset } from '@/lib/ai/assets/markdown';
import type { JuanieSkillDefinition } from '@/lib/ai/skills/types';

const skillAssetPaths = [
  'src/lib/ai/skills/definitions/environment-skill/SKILL.md',
  'src/lib/ai/skills/definitions/migration-skill/SKILL.md',
  'src/lib/ai/skills/definitions/envvar-skill/SKILL.md',
  'src/lib/ai/skills/definitions/release-skill/SKILL.md',
  'src/lib/ai/skills/definitions/incident-skill/SKILL.md',
] as const;

const skillFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  scope: z.enum(['team', 'project', 'environment', 'release']),
  pluginIds: z.array(z.string().min(1)).min(1),
  toolIds: z.array(z.string().min(1)),
  contextProviderIds: z.array(z.string().min(1)),
  promptKey: z.string().min(1).nullable().optional(),
  outputSchema: z.string().min(1).nullable().optional(),
});

let cachedSkills: JuanieSkillDefinition[] | null = null;

function loadSkillDefinitions(): JuanieSkillDefinition[] {
  if (cachedSkills) {
    return cachedSkills;
  }

  cachedSkills = skillAssetPaths.map((assetPath) => {
    const asset = loadMarkdownAsset<unknown>(assetPath);
    const frontmatter = skillFrontmatterSchema.parse(asset.frontmatter);
    const folderId = assetPath.split('/').at(-2);
    if (!folderId) {
      throw new Error(`Skill asset path is invalid: ${assetPath}`);
    }
    if (frontmatter.id !== folderId) {
      throw new Error(
        `Skill asset id mismatch: expected "${folderId}" but got "${frontmatter.id}" in ${assetPath}`
      );
    }

    return {
      ...frontmatter,
      promptKey: frontmatter.promptKey ?? null,
      outputSchema: frontmatter.outputSchema ?? null,
      assetPath,
    } satisfies JuanieSkillDefinition;
  });

  return cachedSkills;
}

export function listJuanieSkills(): JuanieSkillDefinition[] {
  return [...loadSkillDefinitions()];
}

export function getJuanieSkillById(id: string): JuanieSkillDefinition | null {
  return loadSkillDefinitions().find((skill) => skill.id === id) ?? null;
}
