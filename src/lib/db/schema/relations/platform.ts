import { relations } from 'drizzle-orm';
import {
  auditLogs,
  domains,
  environments,
  environmentVariables,
  projects,
  services,
  teams,
  users,
} from '@/lib/db/schema/tables';

export const domainsRelations = relations(domains, ({ one }) => ({
  project: one(projects, {
    fields: [domains.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [domains.environmentId],
    references: [environments.id],
  }),
  service: one(services, {
    fields: [domains.serviceId],
    references: [services.id],
  }),
}));

export const environmentVariablesRelations = relations(environmentVariables, ({ one }) => ({
  project: one(projects, {
    fields: [environmentVariables.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [environmentVariables.environmentId],
    references: [environments.id],
  }),
  service: one(services, {
    fields: [environmentVariables.serviceId],
    references: [services.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  team: one(teams, {
    fields: [auditLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
