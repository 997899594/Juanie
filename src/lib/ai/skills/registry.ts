import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { loadMarkdownAsset } from '@/lib/ai/assets/markdown';
import type { JuanieSkillDefinition } from '@/lib/ai/skills/types';

const skillsDefinitionRoot = 'src/lib/ai/skills/definitions';

const skillFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  scope: z.enum(['team', 'project', 'environment', 'release']),
  executionMode: z.enum(['structured', 'chat', 'hybrid']).optional(),
  surfaces: z
    .array(z.enum(['copilot-panel', 'inline-card', 'action-center', 'task-center']))
    .optional(),
  pluginIds: z.array(z.string().min(1)).min(1),
  toolIds: z.array(z.string().min(1)),
  contextProviderIds: z.array(z.string().min(1)),
  references: z.array(z.string().min(1)).optional(),
  examples: z.array(z.string().min(1)).optional(),
  evals: z.array(z.string().min(1)).optional(),
  promptKey: z.string().min(1).nullable().optional(),
  outputSchema: z.string().min(1).nullable().optional(),
});

let cachedSkills: JuanieSkillDefinition[] | null = null;

function discoverSkillAssetPaths(): string[] {
  const absoluteRoot = resolve(process.cwd(), skillsDefinitionRoot);

  return readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${skillsDefinitionRoot}/${entry.name}/SKILL.md`)
    .filter((assetPath) => existsSync(resolve(process.cwd(), assetPath)))
    .sort();
}

function resolveSkillPackageAssets(assetPath: string, relativePaths?: string[]): string[] {
  if (!relativePaths?.length) {
    return [];
  }

  const absoluteSkillDir = dirname(resolve(process.cwd(), assetPath));

  return relativePaths.map((relativePath) => {
    const absolutePath = resolve(absoluteSkillDir, relativePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Skill asset reference does not exist: ${relativePath} in ${assetPath}`);
    }

    return absolutePath;
  });
}

function loadSkillDefinitions(): JuanieSkillDefinition[] {
  if (cachedSkills) {
    return cachedSkills;
  }

  cachedSkills = discoverSkillAssetPaths().map((assetPath) => {
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
      executionMode: frontmatter.executionMode ?? 'structured',
      surfaces: frontmatter.surfaces ?? [],
      references: resolveSkillPackageAssets(assetPath, frontmatter.references),
      examples: resolveSkillPackageAssets(assetPath, frontmatter.examples),
      evals: resolveSkillPackageAssets(assetPath, frontmatter.evals),
      packagePath: dirname(resolve(process.cwd(), assetPath)),
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
