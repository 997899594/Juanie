export {
  buildProjectOverviewDetails,
  buildProjectOverviewStats,
  decorateProjectDomains,
  decorateProjectRecentReleases,
  decorateProjectServices,
} from '@/lib/projects/project-overview-view';
export type {
  ProjectAttentionRunLike,
  ProjectDatabaseLike,
  ProjectDeploymentLike,
  ProjectDomainDecorations,
  ProjectDomainLike,
  ProjectMigrationRunLike,
  ProjectOverviewDetails,
  ProjectOverviewProjectLike,
  ProjectOverviewStat,
  ProjectRecentReleaseDecorations,
  ProjectReleaseLike,
  ProjectServiceDecorations,
  ProjectServiceLike,
} from '@/lib/projects/project-view-shared';
export {
  decorateProjectAttentionRuns,
  decorateProjectDatabaseCards,
  type ProjectAttentionItemDecorations,
  type ProjectDatabaseCardDecorations,
} from '@/lib/projects/project-view-shared';
export { resolveProjectRuntimeStatus } from '@/lib/projects/runtime-status';
