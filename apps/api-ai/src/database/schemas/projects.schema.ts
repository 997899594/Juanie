import { pgTable, serial, integer, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from './organizations.schema';

// 枚举定义
export const ProjectStatusEnum = z.enum(['active', 'inactive', 'archived', 'suspended']);
export const ProjectVisibilityEnum = z.enum(['public', 'private', 'internal']);

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  displayName: text('display_name'),
  description: text('description'),
  repositoryUrl: text('repository_url'),
  visibility: text('visibility').default('private'), // 'public', 'private', 'internal'
  status: text('status').default('active'), // 'active', 'inactive', 'archived', 'suspended'
  settings: jsonb('settings').default({}),
  aiSettings: jsonb('ai_settings').default({}),
  resourceLimits: jsonb('resource_limits').default({}),
  currentUsage: jsonb('current_usage').default({}),
  tags: jsonb('tags').default([]),
  isArchived: boolean('is_archived').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const projectsOrganizationIdx = index('projects_organization_idx').on(projects.organizationId);
export const projectsSlugIdx = index('projects_slug_idx').on(projects.slug);
export const projectsStatusIdx = index('projects_status_idx').on(projects.status);
export const projectsVisibilityIdx = index('projects_visibility_idx').on(projects.visibility);

// Relations
export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertProjectSchema = createInsertSchema(projects);

export const selectProjectSchema = createSelectSchema(projects);

export const updateProjectSchema = insertProjectSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>;
export type ProjectVisibility = z.infer<typeof ProjectVisibilityEnum>;