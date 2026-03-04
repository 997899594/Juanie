/**
 * Affected services calculation module
 * Determines which services are affected by file changes in a monorepo
 */

/**
 * Service with monorepo configuration
 * This interface extends the base service with optional monorepo config
 * The monorepo.appDir is typically stored in service.configJson or derived from project config
 */
export interface ServiceWithMonorepo {
  id: string;
  name: string;
  projectId: string;
  type: 'web' | 'worker' | 'cron';
  /**
   * Monorepo configuration for this service
   * In practice, this may come from:
   * - service.configJson (if services have their own config)
   * - project.configJson.services[serviceName] (if config is at project level)
   */
  monorepoConfig?: {
    appDir?: string;
  };
}

/**
 * Service configuration JSON structure from project config
 */
export interface ProjectServiceConfig {
  monorepo?: {
    appDir?: string;
  };
}

/**
 * Checks if a path is affected by the changed files
 *
 * A service is considered affected if:
 * 1. Any changed file is within the service's app directory
 * 2. Any changed file is in the shared packages/ directory (affects all services)
 *
 * @param changedFiles - Array of changed file paths
 * @param appDir - The app directory of the service (e.g., "apps/web")
 * @returns true if the service is affected by the changes
 */
export function isPathAffected(changedFiles: string[], appDir: string): boolean {
  return changedFiles.some(
    (file) =>
      // File is within the app directory
      file.startsWith(`${appDir}/`) ||
      file === appDir ||
      // File is in shared packages directory (affects all services)
      file.startsWith('packages/')
  );
}

/**
 * Gets all services affected by the changed files
 *
 * @param changedFiles - Array of changed file paths
 * @param services - Array of services with monorepo config to check
 * @returns Array of affected services
 */
export function getAffectedServices(
  changedFiles: string[],
  services: ServiceWithMonorepo[]
): ServiceWithMonorepo[] {
  return services.filter((service) => {
    const appDir = service.monorepoConfig?.appDir;

    if (!appDir) {
      // If no appDir is configured, the service is not part of monorepo
      // In this case, consider it affected by default (traditional single-repo behavior)
      return true;
    }

    return isPathAffected(changedFiles, appDir);
  });
}

/**
 * Builds the full image name for a service
 *
 * Format: {registry}/{repoFullName}/{serviceName}
 * Example: registry.example.com/owner/repo/web
 *
 * @param registry - Container registry URL (e.g., "registry.example.com")
 * @param repoFullName - Full repository name (e.g., "owner/repo")
 * @param serviceName - Name of the service
 * @returns The full image name
 */
export function buildImageName(
  registry: string,
  repoFullName: string,
  serviceName: string
): string {
  return `${registry}/${repoFullName}/${serviceName}`;
}

/**
 * Gets the app directory for a service from its configuration
 *
 * @param service - The service to get the app directory for
 * @returns The app directory path, or null if not configured
 */
export function getServiceAppDir(service: ServiceWithMonorepo): string | null {
  return service.monorepoConfig?.appDir ?? null;
}

/**
 * Checks if a service is part of a monorepo setup
 *
 * @param service - The service to check
 * @returns true if the service has monorepo configuration
 */
export function isMonorepoService(service: ServiceWithMonorepo): boolean {
  return service.monorepoConfig?.appDir !== undefined;
}

/**
 * Filters services that need to be deployed based on changed files
 * Only returns services that are actually affected by the changes
 *
 * @param changedFiles - Array of changed file paths
 * @param services - Array of all services in the project
 * @returns Array of service names that need to be deployed
 */
export function getAffectedServiceNames(
  changedFiles: string[],
  services: ServiceWithMonorepo[]
): string[] {
  return getAffectedServices(changedFiles, services).map((s) => s.name);
}
