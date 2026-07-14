/**
 * Monorepo support module
 * Provides utilities for detecting monorepo types and calculating affected services
 */

export {
  type DeliveryGraph,
  type DeliveryGraphArtifact,
  type DeliveryGraphLibrary,
  type DeliveryGraphResource,
  type DeliveryGraphSummary,
  type DeliveryGraphWarning,
  type DeliveryGraphWorkload,
  summarizeDeliveryGraph,
} from '@/lib/delivery-graph/model';
// Re-export all functions and types from affected.ts
export {
  buildMonorepoServiceImageName,
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
  type MonorepoConfig,
  type MonorepoType,
} from './detect';
export {
  inspectRepositoryTopology,
  parseDockerBakeTargets,
  type RepositoryTopology,
  type RepositoryTopologyBuild,
  type RepositoryTopologyReader,
  type RepositoryTopologyService,
} from './topology';
export {
  createTurborepoWorkspaceGraph,
  getTurborepoAffectedPolicy,
  getTurborepoAppDir,
  getTurborepoPackageName,
  isTurborepoType,
  type TurborepoAffectedPolicy,
  type TurborepoWorkspaceGraph,
  type TurborepoWorkspaceService,
} from './workspace-graph';
