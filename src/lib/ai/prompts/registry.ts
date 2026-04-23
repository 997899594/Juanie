import { z } from 'zod';
import { loadMarkdownAsset } from '@/lib/ai/assets/markdown';

const promptAssetPaths = {
  'dynamic-plugin': 'src/lib/ai/prompts/definitions/dynamic-plugin.md',
  'environment-summary': 'src/lib/ai/prompts/definitions/environment-summary.md',
  'envvar-risk': 'src/lib/ai/prompts/definitions/envvar-risk.md',
  'incident-analysis': 'src/lib/ai/prompts/definitions/incident-analysis.md',
  'migration-review': 'src/lib/ai/prompts/definitions/migration-review.md',
  'release-plan': 'src/lib/ai/prompts/definitions/release-plan.md',
} as const;

const promptFrontmatterSchema = z.object({
  key: z.string().min(1),
  version: z.string().min(1),
  skillId: z.string().min(1).nullable().optional(),
});

export type JuaniePromptKey = keyof typeof promptAssetPaths;
const promptAssetEntries = Object.entries(promptAssetPaths) as Array<
  [JuaniePromptKey, (typeof promptAssetPaths)[JuaniePromptKey]]
>;

export interface JuaniePromptDefinition {
  key: JuaniePromptKey;
  version: string;
  skillId: string | null;
  system: string;
  assetPath: string;
}

let cachedPrompts: Record<JuaniePromptKey, JuaniePromptDefinition> | null = null;

function loadPromptRegistry(): Record<JuaniePromptKey, JuaniePromptDefinition> {
  if (cachedPrompts) {
    return cachedPrompts;
  }

  cachedPrompts = Object.fromEntries(
    promptAssetEntries.map(([key, assetPath]) => {
      const asset = loadMarkdownAsset<unknown>(assetPath);
      const frontmatter = promptFrontmatterSchema.parse(asset.frontmatter);
      if (frontmatter.key !== key) {
        throw new Error(
          `Prompt asset key mismatch: expected "${key}" but got "${frontmatter.key}" in ${assetPath}`
        );
      }

      return [
        key,
        {
          key,
          version: frontmatter.version,
          skillId: frontmatter.skillId ?? null,
          system: asset.body,
          assetPath,
        } satisfies JuaniePromptDefinition,
      ];
    })
  ) as Record<JuaniePromptKey, JuaniePromptDefinition>;

  return cachedPrompts;
}

export function getPromptDefinition(key: JuaniePromptKey): JuaniePromptDefinition {
  return loadPromptRegistry()[key];
}

export function getPromptVersionedKey(key: JuaniePromptKey): string {
  const prompt = getPromptDefinition(key);
  return `${prompt.key}@${prompt.version}`;
}
