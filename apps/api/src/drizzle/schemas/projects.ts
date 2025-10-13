import { boolean, integer, json, pgTable, text } from 'drizzle-orm/pg-core'
import { auditFields, baseFields } from './base'
import { projectStatusEnum } from './enums'
import { users } from './users'

export const projects = pgTable('projects', {
  ...baseFields,
  ...auditFields,
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  avatar: text('avatar'),
  techStack: json('tech_stack').$type<string[]>().default([]).notNull(),
  status: projectStatusEnum('status').default('ACTIVE').notNull(),
  settings: json('settings').$type<ProjectSettings>().default({}).notNull(),
  metadata: json('metadata').default({}).notNull(),
  isPublic: boolean('is_public').default(false).notNull(),
  starCount: integer('star_count').default(0).notNull(),
  forkCount: integer('fork_count').default(0).notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
})

export interface ProjectSettings {
  features?: {
    git?: boolean
    cicd?: boolean
    monitoring?: boolean
    deployment?: boolean
  }
  integrations?: {
    github?: { enabled: boolean; config?: any }
    gitlab?: { enabled: boolean; config?: any }
    docker?: { enabled: boolean; config?: any }
  }
  permissions?: {
    defaultRole?: string
    allowFork?: boolean
    allowContribute?: boolean
  }
}

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
