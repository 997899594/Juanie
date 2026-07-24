import { relations } from 'drizzle-orm';
import {
  aiPluginRuns,
  aiPluginSnapshots,
  aiTasks,
  artifactDownloadEvents,
  buildArtifacts,
  buildRuns,
  buildUnits,
  deliveryExecutionEvents,
  deliveryExecutions,
  deploymentDiagnostics,
  deploymentLogs,
  deployments,
  environments,
  migrationRuns,
  projects,
  promotionApprovalEvents,
  promotionRequests,
  releaseArtifacts,
  releaseEvents,
  releaseMigrationPlans,
  releases,
  repositories,
  repositoryWebhookControllers,
  services,
  sourceDeliveries,
  teams,
  users,
} from '@/lib/db/schema/tables';

export const sourceDeliveriesRelations = relations(sourceDeliveries, ({ one }) => ({
  deliveryExecution: one(deliveryExecutions, {
    fields: [sourceDeliveries.deliveryExecutionId],
    references: [deliveryExecutions.id],
  }),
  project: one(projects, {
    fields: [sourceDeliveries.projectId],
    references: [projects.id],
  }),
  repository: one(repositories, {
    fields: [sourceDeliveries.repositoryId],
    references: [repositories.id],
  }),
}));

export const deliveryExecutionsRelations = relations(deliveryExecutions, ({ one, many }) => ({
  project: one(projects, {
    fields: [deliveryExecutions.projectId],
    references: [projects.id],
  }),
  repository: one(repositories, {
    fields: [deliveryExecutions.repositoryId],
    references: [repositories.id],
  }),
  events: many(deliveryExecutionEvents),
  sourceDeliveries: many(sourceDeliveries),
  buildRuns: many(buildRuns),
  releases: many(releases),
  promotionRequests: many(promotionRequests),
  deployments: many(deployments),
}));

export const deliveryExecutionEventsRelations = relations(deliveryExecutionEvents, ({ one }) => ({
  deliveryExecution: one(deliveryExecutions, {
    fields: [deliveryExecutionEvents.deliveryExecutionId],
    references: [deliveryExecutions.id],
  }),
}));

export const buildRunsRelations = relations(buildRuns, ({ one, many }) => ({
  deliveryExecution: one(deliveryExecutions, {
    fields: [buildRuns.deliveryExecutionId],
    references: [deliveryExecutions.id],
  }),
  project: one(projects, {
    fields: [buildRuns.projectId],
    references: [projects.id],
  }),
  repository: one(repositories, {
    fields: [buildRuns.repositoryId],
    references: [repositories.id],
  }),
  release: one(releases, {
    fields: [buildRuns.releaseId],
    references: [releases.id],
  }),
  units: many(buildUnits),
  artifacts: many(buildArtifacts),
}));

export const buildUnitsRelations = relations(buildUnits, ({ one, many }) => ({
  buildRun: one(buildRuns, {
    fields: [buildUnits.buildRunId],
    references: [buildRuns.id],
  }),
  service: one(services, {
    fields: [buildUnits.serviceId],
    references: [services.id],
  }),
  artifacts: many(buildArtifacts),
}));

export const buildArtifactsRelations = relations(buildArtifacts, ({ one }) => ({
  buildRun: one(buildRuns, {
    fields: [buildArtifacts.buildRunId],
    references: [buildRuns.id],
  }),
  buildUnit: one(buildUnits, {
    fields: [buildArtifacts.buildUnitId],
    references: [buildUnits.id],
  }),
  service: one(services, {
    fields: [buildArtifacts.serviceId],
    references: [services.id],
  }),
}));

export const releasesRelations = relations(releases, ({ one, many }) => ({
  deliveryExecution: one(deliveryExecutions, {
    fields: [releases.deliveryExecutionId],
    references: [deliveryExecutions.id],
  }),
  promotionRequest: one(promotionRequests, {
    fields: [releases.promotionRequestId],
    references: [promotionRequests.id],
    relationName: 'promotion_production_release',
  }),
  project: one(projects, {
    fields: [releases.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [releases.environmentId],
    references: [environments.id],
  }),
  triggeredByUser: one(users, {
    fields: [releases.triggeredByUserId],
    references: [users.id],
  }),
  sourceRelease: one(releases, {
    fields: [releases.sourceReleaseId],
    references: [releases.id],
    relationName: 'release_lineage',
  }),
  derivedReleases: many(releases, {
    relationName: 'release_lineage',
  }),
  artifacts: many(releaseArtifacts),
  deployments: many(deployments),
  migrationRuns: many(migrationRuns),
  migrationPlan: one(releaseMigrationPlans),
  aiPluginRuns: many(aiPluginRuns),
  aiPluginSnapshots: many(aiPluginSnapshots),
  aiTasks: many(aiTasks),
  artifactDownloadEvents: many(artifactDownloadEvents),
  buildRuns: many(buildRuns),
  events: many(releaseEvents),
}));

export const promotionRequestsRelations = relations(promotionRequests, ({ one, many }) => ({
  deliveryExecution: one(deliveryExecutions, {
    fields: [promotionRequests.deliveryExecutionId],
    references: [deliveryExecutions.id],
  }),
  project: one(projects, {
    fields: [promotionRequests.projectId],
    references: [projects.id],
  }),
  sourceRelease: one(releases, {
    fields: [promotionRequests.sourceReleaseId],
    references: [releases.id],
    relationName: 'promotion_source_release',
  }),
  productionRelease: one(releases, {
    fields: [promotionRequests.productionReleaseId],
    references: [releases.id],
    relationName: 'promotion_production_release',
  }),
  requestedByUser: one(users, {
    fields: [promotionRequests.requestedByUserId],
    references: [users.id],
    relationName: 'promotion_requested_by',
  }),
  approvedByUser: one(users, {
    fields: [promotionRequests.approvedByUserId],
    references: [users.id],
    relationName: 'promotion_approved_by',
  }),
  approvalEvents: many(promotionApprovalEvents),
}));

export const promotionApprovalEventsRelations = relations(promotionApprovalEvents, ({ one }) => ({
  promotionRequest: one(promotionRequests, {
    fields: [promotionApprovalEvents.promotionRequestId],
    references: [promotionRequests.id],
  }),
  actorUser: one(users, {
    fields: [promotionApprovalEvents.actorUserId],
    references: [users.id],
  }),
}));

export const repositoryWebhookControllersRelations = relations(
  repositoryWebhookControllers,
  ({ one }) => ({
    repository: one(repositories, {
      fields: [repositoryWebhookControllers.repositoryId],
      references: [repositories.id],
    }),
  })
);

export const releaseEventsRelations = relations(releaseEvents, ({ one }) => ({
  release: one(releases, {
    fields: [releaseEvents.releaseId],
    references: [releases.id],
  }),
  project: one(projects, {
    fields: [releaseEvents.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [releaseEvents.environmentId],
    references: [environments.id],
  }),
  actorUser: one(users, {
    fields: [releaseEvents.actorUserId],
    references: [users.id],
  }),
}));

export const releaseArtifactsRelations = relations(releaseArtifacts, ({ one, many }) => ({
  release: one(releases, {
    fields: [releaseArtifacts.releaseId],
    references: [releases.id],
  }),
  service: one(services, {
    fields: [releaseArtifacts.serviceId],
    references: [services.id],
  }),
  sourceService: one(services, {
    fields: [releaseArtifacts.sourceServiceId],
    references: [services.id],
  }),
  downloadEvents: many(artifactDownloadEvents),
}));

export const artifactDownloadEventsRelations = relations(artifactDownloadEvents, ({ one }) => ({
  team: one(teams, {
    fields: [artifactDownloadEvents.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [artifactDownloadEvents.projectId],
    references: [projects.id],
  }),
  release: one(releases, {
    fields: [artifactDownloadEvents.releaseId],
    references: [releases.id],
  }),
  artifact: one(releaseArtifacts, {
    fields: [artifactDownloadEvents.artifactId],
    references: [releaseArtifacts.id],
  }),
  user: one(users, {
    fields: [artifactDownloadEvents.userId],
    references: [users.id],
  }),
}));

export const deploymentsRelations = relations(deployments, ({ one, many }) => ({
  deliveryExecution: one(deliveryExecutions, {
    fields: [deployments.deliveryExecutionId],
    references: [deliveryExecutions.id],
  }),
  release: one(releases, {
    fields: [deployments.releaseId],
    references: [releases.id],
  }),
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [deployments.environmentId],
    references: [environments.id],
  }),
  service: one(services, {
    fields: [deployments.serviceId],
    references: [services.id],
  }),
  deployedBy: one(users, {
    fields: [deployments.deployedById],
    references: [users.id],
  }),
  logs: many(deploymentLogs),
  diagnostics: many(deploymentDiagnostics),
}));

export const deploymentLogsRelations = relations(deploymentLogs, ({ one }) => ({
  deployment: one(deployments, {
    fields: [deploymentLogs.deploymentId],
    references: [deployments.id],
  }),
}));

export const deploymentDiagnosticsRelations = relations(deploymentDiagnostics, ({ one }) => ({
  deployment: one(deployments, {
    fields: [deploymentDiagnostics.deploymentId],
    references: [deployments.id],
  }),
  release: one(releases, {
    fields: [deploymentDiagnostics.releaseId],
    references: [releases.id],
  }),
  project: one(projects, {
    fields: [deploymentDiagnostics.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [deploymentDiagnostics.environmentId],
    references: [environments.id],
  }),
  service: one(services, {
    fields: [deploymentDiagnostics.serviceId],
    references: [services.id],
  }),
}));
