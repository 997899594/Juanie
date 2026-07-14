import { relations } from 'drizzle-orm';
import {
  aiEntitlements,
  aiPluginInstallations,
  aiPluginRuns,
  aiPluginSnapshots,
  aiTasks,
  artifactDownloadEvents,
  auditLogs,
  integrationIdentities,
  projects,
  teamIntegrationBindings,
  teamInvitations,
  teamMembers,
  teams,
  users,
} from '@/lib/db/schema/tables';

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  projects: many(projects),
  invitations: many(teamInvitations),
  integrationBindings: many(teamIntegrationBindings),
  auditLogs: many(auditLogs),
  aiPluginInstallations: many(aiPluginInstallations),
  aiEntitlements: many(aiEntitlements),
  aiPluginRuns: many(aiPluginRuns),
  aiPluginSnapshots: many(aiPluginSnapshots),
  aiTasks: many(aiTasks),
  artifactDownloadEvents: many(artifactDownloadEvents),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
}));

export const teamIntegrationBindingsRelations = relations(teamIntegrationBindings, ({ one }) => ({
  team: one(teams, {
    fields: [teamIntegrationBindings.teamId],
    references: [teams.id],
  }),
  integrationIdentity: one(integrationIdentities, {
    fields: [teamIntegrationBindings.integrationIdentityId],
    references: [integrationIdentities.id],
  }),
  createdByUser: one(users, {
    fields: [teamIntegrationBindings.createdByUserId],
    references: [users.id],
  }),
}));
