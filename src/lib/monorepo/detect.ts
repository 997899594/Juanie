/**
 * Monorepo type detection module
 * Detects the monorepo tool type based on repository files
 */

/**
 * Supported monorepo types
 */
export type MonorepoType = 'turborepo' | 'nx' | 'pnpm' | 'none';

/**
 * Monorepo configuration from project config
 */
export interface MonorepoConfig {
  enabled?: boolean;
  type?: MonorepoType;
}

/**
 * Detects the monorepo type based on the list of files in a repository
 *
 * Detection priority:
 * 1. turbo.json -> Turborepo
 * 2. pnpm-workspace.yaml -> pnpm workspaces
 * 3. nx.json or lerna.json -> Nx
 * 4. packages/ or apps/ directories -> pnpm (fallback)
 *
 * @param files - Array of file paths in the repository root
 * @returns The detected monorepo type, or 'none' if not a monorepo
 */
export function detectMonorepoType(files: string[]): MonorepoType {
  // 1. Check for turbo.json (Turborepo)
  if (files.includes('turbo.json')) {
    return 'turborepo';
  }

  // 2. Check for pnpm-workspace.yaml (pnpm workspaces)
  if (files.includes('pnpm-workspace.yaml')) {
    return 'pnpm';
  }

  // 3. Check for nx.json or lerna.json (Nx)
  if (files.includes('nx.json') || files.includes('lerna.json')) {
    return 'nx';
  }

  // 4. Check for common monorepo directory structure
  // If there are files in packages/ or apps/ directories, assume pnpm-style monorepo
  if (files.some((f) => f.startsWith('packages/') || f.startsWith('apps/'))) {
    return 'pnpm';
  }

  return 'none';
}

/**
 * Gets the appropriate build command for a monorepo type
 *
 * @param monorepoType - The detected monorepo type
 * @param appName - The name of the app/service to build
 * @returns The build command string
 */
export function getMonorepoBuildCommand(monorepoType: MonorepoType, appName: string): string {
  switch (monorepoType) {
    case 'turborepo':
      return `turbo run build --filter=${appName}`;
    case 'nx':
      return `nx build ${appName}`;
    case 'pnpm':
      return `pnpm --filter ${appName} build`;
    default:
      return 'pnpm build';
  }
}

/**
 * Gets the appropriate install command for a monorepo type
 *
 * @param monorepoType - The detected monorepo type
 * @returns The install command string
 */
export function getMonorepoInstallCommand(monorepoType: MonorepoType): string {
  switch (monorepoType) {
    case 'turborepo':
    case 'pnpm':
      return 'pnpm install';
    case 'nx':
      return 'npm ci';
    default:
      return 'pnpm install';
  }
}

/**
 * Checks if the repository is a monorepo
 * Can be called with either a files array or a config object
 *
 * @param filesOrConfig - Array of file paths in the repository root, or a config object
 * @returns true if the repository is detected as a monorepo or enabled in config
 */
export function isMonorepo(filesOrConfig: string[] | MonorepoConfig | null | undefined): boolean {
  // If config object is passed
  if (filesOrConfig && !Array.isArray(filesOrConfig)) {
    return filesOrConfig.enabled === true;
  }

  // If files array is passed
  if (Array.isArray(filesOrConfig)) {
    return detectMonorepoType(filesOrConfig) !== 'none';
  }

  return false;
}
