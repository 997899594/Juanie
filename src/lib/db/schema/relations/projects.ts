import { relations } from 'drizzle-orm';
import {
  aiPluginRuns,
  aiPluginSnapshots,
  aiTasks,
  artifactDownloadEvents,
  buildArtifacts,
  buildRuns,
  buildUnits,
  databases,
  deliveryRules,
  deployments,
  domains,
  environments,
  environmentVariables,
  migrationRuns,
  migrationSpecifications,
  projectInitSteps,
  projects,
  promotionFlows,
  releaseArtifacts,
  releases,
  repositories,
  services,
  teams,
} from '@/lib/db/schema/tables';

export const projectsRelations = relations(projects, ({ one, many }) => ({
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  repository: one(repositories, {
    fields: [projects.repositoryId],
    references: [repositories.id],
  }),
  services: many(services),
  environments: many(environments),
  deliveryRules: many(deliveryRules),
  promotionFlows: many(promotionFlows),
  databases: many(databases),
  domains: many(domains),
  environmentVariables: many(environmentVariables),
  releases: many(releases),
  buildRuns: many(buildRuns),
  deployments: many(deployments),
  initSteps: many(projectInitSteps),
  aiPluginRuns: many(aiPluginRuns),
  aiPluginSnapshots: many(aiPluginSnapshots),
  aiTasks: many(aiTasks),
  artifactDownloadEvents: many(artifactDownloadEvents),
}));

export const projectInitStepsRelations = relations(projectInitSteps, ({ one }) => ({
  project: one(projects, {
    fields: [projectInitSteps.projectId],
    references: [projects.id],
  }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  project: one(projects, {
    fields: [services.projectId],
    references: [projects.id],
  }),
  domains: many(domains),
  deployments: many(deployments),
  environmentVariables: many(environmentVariables),
  databases: many(databases),
  releaseArtifacts: many(releaseArtifacts),
  buildUnits: many(buildUnits),
  buildArtifacts: many(buildArtifacts),
  migrationSpecifications: many(migrationSpecifications),
  migrationRuns: many(migrationRuns),
}));

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id],
  }),
  baseEnvironment: one(environments, {
    fields: [environments.baseEnvironmentId],
    references: [environments.id],
    relationName: 'environment_inheritance',
  }),
  derivedEnvironments: many(environments, {
    relationName: 'environment_inheritance',
  }),
  deliveryRules: many(deliveryRules),
  promotionSourceFlows: many(promotionFlows, {
    relationName: 'promotion_flow_source_environment',
  }),
  promotionTargetFlows: many(promotionFlows, {
    relationName: 'promotion_flow_target_environment',
  }),
  domains: many(domains),
  releases: many(releases),
  deployments: many(deployments),
  environmentVariables: many(environmentVariables),
  databases: many(databases),
  aiPluginRuns: many(aiPluginRuns),
  aiPluginSnapshots: many(aiPluginSnapshots),
  aiTasks: many(aiTasks),
}));

export const deliveryRulesRelations = relations(deliveryRules, ({ one }) => ({
  project: one(projects, {
    fields: [deliveryRules.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [deliveryRules.environmentId],
    references: [environments.id],
  }),
}));

export const promotionFlowsRelations = relations(promotionFlows, ({ one }) => ({
  project: one(projects, {
    fields: [promotionFlows.projectId],
    references: [projects.id],
  }),
  sourceEnvironment: one(environments, {
    fields: [promotionFlows.sourceEnvironmentId],
    references: [environments.id],
    relationName: 'promotion_flow_source_environment',
  }),
  targetEnvironment: one(environments, {
    fields: [promotionFlows.targetEnvironmentId],
    references: [environments.id],
    relationName: 'promotion_flow_target_environment',
  }),
}));
