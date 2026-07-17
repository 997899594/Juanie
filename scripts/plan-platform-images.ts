import { execFileSync } from 'node:child_process';

export const platformImageTargets = ['web', 'runtime', 'schema-runner'] as const;
export type PlatformImageTarget = (typeof platformImageTargets)[number];

export interface PlatformImagePlan {
  targets: PlatformImageTarget[];
  changedPaths: string[];
  reasons: string[];
}

const imageNeutralPrefixes = [
  '.github/',
  'deploy/',
  'docs/',
  'interview-prep/',
  'scripts/',
] as const;
const imageNeutralFiles = new Set([
  '.env.example',
  '.gitattributes',
  '.gitignore',
  'AGENTS.md',
  'LICENSE',
  'README.md',
  'biome.json',
  'lefthook.yml',
]);
const schemaRunnerPrefixes = ['migrations/', 'migrations-contract/'] as const;
const schemaRunnerFiles = new Set(['atlas.hcl', 'atlas.contract.hcl']);

function normalizePaths(paths: string[]): string[] {
  return [...new Set(paths.map((path) => path.trim()).filter(Boolean))].sort();
}

function isImageNeutral(path: string): boolean {
  if (path === 'scripts/prepare.ts') return false;
  return (
    imageNeutralFiles.has(path) || imageNeutralPrefixes.some((prefix) => path.startsWith(prefix))
  );
}

function isSchemaRunnerOnly(path: string): boolean {
  return (
    schemaRunnerFiles.has(path) || schemaRunnerPrefixes.some((prefix) => path.startsWith(prefix))
  );
}

export function planPlatformImages(changedPaths: string[]): PlatformImagePlan {
  const normalizedPaths = normalizePaths(changedPaths);
  const imageInputs = normalizedPaths.filter((path) => !isImageNeutral(path));
  const generalImageInputs = imageInputs.filter((path) => !isSchemaRunnerOnly(path));
  const schemaRunnerInputs = imageInputs.filter(isSchemaRunnerOnly);

  if (generalImageInputs.length > 0) {
    return {
      targets: [...platformImageTargets],
      changedPaths: normalizedPaths,
      reasons: [`shared image inputs changed: ${generalImageInputs.join(', ')}`],
    };
  }

  if (schemaRunnerInputs.length > 0) {
    return {
      targets: ['schema-runner'],
      changedPaths: normalizedPaths,
      reasons: [`schema inputs changed: ${schemaRunnerInputs.join(', ')}`],
    };
  }

  return {
    targets: [],
    changedPaths: normalizedPaths,
    reasons: ['only image-neutral platform files changed'],
  };
}

function changedPathsBetween(baseRevision: string, headRevision: string): string[] | null {
  if (/^0+$/u.test(baseRevision)) return null;

  try {
    const output = execFileSync(
      'git',
      [
        'diff',
        '--name-only',
        '--no-renames',
        '--diff-filter=ACDMRT',
        baseRevision,
        headRevision,
        '--',
      ],
      { encoding: 'utf8' }
    );
    return output.split('\n');
  } catch {
    return null;
  }
}

if (import.meta.main) {
  const [baseRevision, headRevision = 'HEAD'] = process.argv.slice(2);
  if (!baseRevision) {
    throw new Error('Usage: bun scripts/plan-platform-images.ts <base-revision> [head-revision]');
  }

  const changedPaths = changedPathsBetween(baseRevision, headRevision);
  const plan =
    changedPaths === null
      ? {
          targets: [...platformImageTargets],
          changedPaths: [],
          reasons: ['no trustworthy base revision; rebuilding every image'],
        }
      : planPlatformImages(changedPaths);

  process.stdout.write(`${JSON.stringify(plan)}\n`);
}
