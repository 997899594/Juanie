import { relations } from 'drizzle-orm';
import {
  databaseMigrations,
  databases,
  deployments,
  environmentSchemaStateRevisions,
  environmentSchemaStates,
  environments,
  migrationRunItems,
  migrationRuns,
  migrationSpecifications,
  projects,
  releases,
  schemaRepairAtlasRuns,
  schemaRepairPlans,
  services,
  users,
} from '@/lib/db/schema/tables';

export const databasesRelations = relations(databases, ({ one, many }) => ({
  project: one(projects, {
    fields: [databases.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [databases.environmentId],
    references: [environments.id],
  }),
  service: one(services, {
    fields: [databases.serviceId],
    references: [services.id],
  }),
  sourceDatabase: one(databases, {
    fields: [databases.sourceDatabaseId],
    references: [databases.id],
    relationName: 'database_clone',
  }),
  derivedDatabases: many(databases, {
    relationName: 'database_clone',
  }),
  migrations: many(databaseMigrations),
  schemaState: one(environmentSchemaStates, {
    fields: [databases.id],
    references: [environmentSchemaStates.databaseId],
  }),
  schemaStateRevisions: many(environmentSchemaStateRevisions),
  repairPlans: many(schemaRepairPlans),
  migrationSpecifications: many(migrationSpecifications),
  migrationRuns: many(migrationRuns),
}));

export const migrationSpecificationsRelations = relations(
  migrationSpecifications,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [migrationSpecifications.projectId],
      references: [projects.id],
    }),
    service: one(services, {
      fields: [migrationSpecifications.serviceId],
      references: [services.id],
    }),
    environment: one(environments, {
      fields: [migrationSpecifications.environmentId],
      references: [environments.id],
    }),
    database: one(databases, {
      fields: [migrationSpecifications.databaseId],
      references: [databases.id],
    }),
    runs: many(migrationRuns),
  })
);

export const migrationRunsRelations = relations(migrationRuns, ({ one, many }) => ({
  project: one(projects, {
    fields: [migrationRuns.projectId],
    references: [projects.id],
  }),
  service: one(services, {
    fields: [migrationRuns.serviceId],
    references: [services.id],
  }),
  environment: one(environments, {
    fields: [migrationRuns.environmentId],
    references: [environments.id],
  }),
  database: one(databases, {
    fields: [migrationRuns.databaseId],
    references: [databases.id],
  }),
  specification: one(migrationSpecifications, {
    fields: [migrationRuns.specificationId],
    references: [migrationSpecifications.id],
  }),
  release: one(releases, {
    fields: [migrationRuns.releaseId],
    references: [releases.id],
  }),
  deployment: one(deployments, {
    fields: [migrationRuns.deploymentId],
    references: [deployments.id],
  }),
  triggeredByUser: one(users, {
    fields: [migrationRuns.triggeredByUserId],
    references: [users.id],
  }),
  items: many(migrationRunItems),
}));

export const migrationRunItemsRelations = relations(migrationRunItems, ({ one }) => ({
  migrationRun: one(migrationRuns, {
    fields: [migrationRunItems.migrationRunId],
    references: [migrationRuns.id],
  }),
}));

export const databaseMigrationsRelations = relations(databaseMigrations, ({ one }) => ({
  database: one(databases, {
    fields: [databaseMigrations.databaseId],
    references: [databases.id],
  }),
}));

export const environmentSchemaStatesRelations = relations(environmentSchemaStates, ({ one }) => ({
  project: one(projects, {
    fields: [environmentSchemaStates.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [environmentSchemaStates.environmentId],
    references: [environments.id],
  }),
  database: one(databases, {
    fields: [environmentSchemaStates.databaseId],
    references: [databases.id],
  }),
}));

export const environmentSchemaStateRevisionsRelations = relations(
  environmentSchemaStateRevisions,
  ({ one }) => ({
    project: one(projects, {
      fields: [environmentSchemaStateRevisions.projectId],
      references: [projects.id],
    }),
    environment: one(environments, {
      fields: [environmentSchemaStateRevisions.environmentId],
      references: [environments.id],
    }),
    database: one(databases, {
      fields: [environmentSchemaStateRevisions.databaseId],
      references: [databases.id],
    }),
  })
);

export const schemaRepairPlansRelations = relations(schemaRepairPlans, ({ one, many }) => ({
  project: one(projects, {
    fields: [schemaRepairPlans.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [schemaRepairPlans.environmentId],
    references: [environments.id],
  }),
  database: one(databases, {
    fields: [schemaRepairPlans.databaseId],
    references: [databases.id],
  }),
  createdByUser: one(users, {
    fields: [schemaRepairPlans.createdByUserId],
    references: [users.id],
  }),
  atlasRuns: many(schemaRepairAtlasRuns),
}));

export const schemaRepairAtlasRunsRelations = relations(schemaRepairAtlasRuns, ({ one }) => ({
  plan: one(schemaRepairPlans, {
    fields: [schemaRepairAtlasRuns.planId],
    references: [schemaRepairPlans.id],
  }),
  project: one(projects, {
    fields: [schemaRepairAtlasRuns.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [schemaRepairAtlasRuns.environmentId],
    references: [environments.id],
  }),
  database: one(databases, {
    fields: [schemaRepairAtlasRuns.databaseId],
    references: [databases.id],
  }),
}));
