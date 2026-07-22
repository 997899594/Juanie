import { relations } from 'drizzle-orm';
import {
  accounts,
  aiPluginInstallations,
  aiTasks,
  integrationGrants,
  integrationIdentities,
  projects,
  repositories,
  sessions,
  sourceDeliveries,
  teamIntegrationBindings,
  teamMembers,
  users,
} from '@/lib/db/schema/tables';

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  integrationIdentities: many(integrationIdentities),
  teamMemberships: many(teamMembers),
  teamIntegrationBindings: many(teamIntegrationBindings),
  aiPluginInstallations: many(aiPluginInstallations),
  aiTasks: many(aiTasks),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const integrationIdentitiesRelations = relations(integrationIdentities, ({ one, many }) => ({
  user: one(users, {
    fields: [integrationIdentities.userId],
    references: [users.id],
  }),
  grants: many(integrationGrants),
  repositories: many(repositories),
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  provider: one(integrationIdentities, {
    fields: [repositories.providerId],
    references: [integrationIdentities.id],
  }),
  projects: many(projects),
  sourceDeliveries: many(sourceDeliveries),
}));
