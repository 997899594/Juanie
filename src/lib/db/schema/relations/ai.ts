import { relations } from 'drizzle-orm';
import {
  aiEntitlements,
  aiPluginInstallations,
  aiPluginRuns,
  aiPluginSnapshots,
  aiTasks,
  environments,
  projects,
  releases,
  teams,
  users,
} from '@/lib/db/schema/tables';

export const aiPluginInstallationsRelations = relations(aiPluginInstallations, ({ one }) => ({
  team: one(teams, {
    fields: [aiPluginInstallations.teamId],
    references: [teams.id],
  }),
  installedByUser: one(users, {
    fields: [aiPluginInstallations.installedByUserId],
    references: [users.id],
  }),
}));

export const aiEntitlementsRelations = relations(aiEntitlements, ({ one }) => ({
  team: one(teams, {
    fields: [aiEntitlements.teamId],
    references: [teams.id],
  }),
}));

export const aiPluginSnapshotsRelations = relations(aiPluginSnapshots, ({ one }) => ({
  team: one(teams, {
    fields: [aiPluginSnapshots.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [aiPluginSnapshots.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [aiPluginSnapshots.environmentId],
    references: [environments.id],
  }),
  release: one(releases, {
    fields: [aiPluginSnapshots.releaseId],
    references: [releases.id],
  }),
}));

export const aiPluginRunsRelations = relations(aiPluginRuns, ({ one }) => ({
  actor: one(users, {
    fields: [aiPluginRuns.actorUserId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [aiPluginRuns.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [aiPluginRuns.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [aiPluginRuns.environmentId],
    references: [environments.id],
  }),
  release: one(releases, {
    fields: [aiPluginRuns.releaseId],
    references: [releases.id],
  }),
}));

export const aiTasksRelations = relations(aiTasks, ({ one }) => ({
  actor: one(users, {
    fields: [aiTasks.actorUserId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [aiTasks.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [aiTasks.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [aiTasks.environmentId],
    references: [environments.id],
  }),
  release: one(releases, {
    fields: [aiTasks.releaseId],
    references: [releases.id],
  }),
}));
