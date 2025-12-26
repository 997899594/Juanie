/**
 * Drizzle ORM Relations 集中定义
 *
 * 为什么要集中定义？
 * 1. 避免循环依赖：A.schema 导入 B.schema，B.schema 导入 A.schema
 * 2. 清晰的依赖关系：所有表定义先加载，然后统一定义关系
 * 3. 易于维护：所有关系在一个文件中，一目了然
 */
import { relations } from 'drizzle-orm'

// 导入所有表定义 - 按领域组织
import { gitConnections, users } from './schemas/auth'
import { environments } from './schemas/deployment'
import { gitSyncLogs } from './schemas/gitops'
import {
  organizationMembers,
  organizations,
  teamMembers,
  teamProjects,
  teams,
} from './schemas/organization'
import {
  projectInitializationSteps,
  projectMembers,
  projects,
  projectTemplates,
} from './schemas/project'

// ============================================================================
// Users Relations
// ============================================================================
export const usersRelations = relations(users, ({ many }) => ({
  gitConnections: many(gitConnections),
  projectMembers: many(projectMembers),
  organizationMembers: many(organizationMembers),
  teamMembers: many(teamMembers),
}))

// ============================================================================
// Organizations Relations
// ============================================================================
export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, {
    fields: [organizations.ownerId],
    references: [users.id],
  }),
  members: many(organizationMembers),
  projects: many(projects),
}))

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}))

// ============================================================================
// Projects Relations
// ============================================================================
export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  template: one(projectTemplates, {
    fields: [projects.templateId],
    references: [projectTemplates.id],
  }),
  members: many(projectMembers),
  environments: many(environments),
  teamProjects: many(teamProjects),
  initializationSteps: many(projectInitializationSteps),
}))

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}))

// ============================================================================
// Environments Relations
// ============================================================================
export const environmentsRelations = relations(environments, ({ one }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id],
  }),
}))

// ============================================================================
// Teams Relations
// ============================================================================
export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
  projects: many(teamProjects),
}))

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}))

export const teamProjectsRelations = relations(teamProjects, ({ one }) => ({
  team: one(teams, {
    fields: [teamProjects.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [teamProjects.projectId],
    references: [projects.id],
  }),
}))

// ============================================================================
// Git Connections Relations
// ============================================================================
export const gitConnectionsRelations = relations(gitConnections, ({ one }) => ({
  user: one(users, {
    fields: [gitConnections.userId],
    references: [users.id],
  }),
}))

// ============================================================================
// Git Sync Logs Relations
// ============================================================================
export const gitSyncLogsRelations = relations(gitSyncLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [gitSyncLogs.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [gitSyncLogs.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [gitSyncLogs.userId],
    references: [users.id],
  }),
}))

// ============================================================================
// Project Initialization Steps Relations
// ============================================================================
export const projectInitializationStepsRelations = relations(
  projectInitializationSteps,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectInitializationSteps.projectId],
      references: [projects.id],
    }),
  }),
)
