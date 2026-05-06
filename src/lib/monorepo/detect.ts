/**
 * Monorepo type detection module
 * Detects the monorepo tool type based on repository files
 */

/**
 * Supported monorepo types
 */
export type MonorepoType = 'turborepo' | 'none';

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
 *
 * Juanie currently supports Turborepo only. Other workspace layouts are
 * treated as single-repo projects until their build and deploy contracts are
 * implemented end-to-end.
 *
 * @param files - Array of file paths in the repository root
 * @returns The detected monorepo type, or 'none' if not a monorepo
 */
export function detectMonorepoType(files: string[]): MonorepoType {
  if (files.includes('turbo.json')) {
    return 'turborepo';
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
    default:
      return 'npm run build';
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
      return 'pnpm install';
    default:
      return 'npm install';
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
