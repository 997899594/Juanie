/**
 * Monorepo support module
 * Provides utilities for detecting monorepo types and calculating affected services
 */

// Re-export all functions and types from affected.ts
export {
  buildImageName,
  getAffectedServiceNames,
  getAffectedServices,
  getServiceAppDir,
  isMonorepoService,
  isPathAffected,
  type ProjectServiceConfig,
  type ServiceWithMonorepo,
} from './affected';
// Re-export all functions from detect.ts
export {
  detectMonorepoType,
  getMonorepoBuildCommand,
  getMonorepoInstallCommand,
  isMonorepo,
  type MonorepoType,
} from './detect';
