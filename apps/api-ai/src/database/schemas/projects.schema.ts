import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { organizations } from "./organizations.schema";

// 枚举定义
export const ProjectStatusEnum = z.enum([
  "active",
  "inactive",
  "archived",
  "suspended",
]);
export const ProjectVisibilityEnum = z.enum(["public", "private", "internal"]);
export const ProjectStatusPgEnum = pgEnum("project_status", [
  "active",
  "inactive",
  "archived",
  "suspended",
]);
export const ProjectVisibilityPgEnum = pgEnum("project_visibility", [
  "public",
  "private",
  "internal",
]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(), // 项目唯一ID
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id), // 所属组织ID
  name: text("name").notNull(), // 项目名称
  slug: text("slug").notNull(), // 项目标识 slug（URL 友好）
  displayName: text("display_name"), // 展示名称
  description: text("description"), // 项目描述
  repositoryUrl: text("repository_url"), // 代码仓库 URL
  visibility: ProjectVisibilityPgEnum("visibility").default("private"), // 可见性：public / private / internal
  status: ProjectStatusPgEnum("status").default("active"), // 项目状态：active / inactive / archived / suspended

  // 简化项目设置（替代复杂的settings JSONB）
  defaultBranch: text("default_branch").default("main"),
  enableCiCd: boolean("enable_ci_cd").default(true),
  enableAiAssistant: boolean("enable_ai_assistant").default(true),
  enableMonitoring: boolean("enable_monitoring").default(true),

  // 简化AI设置（替代aiSettings JSONB）
  aiModelPreference: text("ai_model_preference").default("gpt-4"), // 首选AI模型
  aiAutoReview: boolean("ai_auto_review").default(true), // 自动代码审查
  aiCostOptimization: boolean("ai_cost_optimization").default(true), // AI成本优化

  // 简化资源限制（替代resourceLimits JSONB）
  maxComputeUnits: integer("max_compute_units").default(100), // 最大计算单元
  maxStorageGb: integer("max_storage_gb").default(100), // 最大存储GB
  maxMonthlyCost: decimal("max_monthly_cost", {
    precision: 10,
    scale: 2,
  }).default("1000.00"), // 最大月度成本

  // 简化当前使用统计（替代currentUsage JSONB）
  currentComputeUnits: integer("current_compute_units").default(0), // 当前计算单元使用
  currentStorageGb: integer("current_storage_gb").default(0), // 当前存储使用
  currentMonthlyCost: decimal("current_monthly_cost", {
    precision: 10,
    scale: 2,
  }).default("0.00"), // 当前月度成本

  // 简化标签（替代tags JSONB数组）
  primaryTag: text("primary_tag"), // 主要标签
  secondaryTags: text("secondary_tags"), // 次要标签，逗号分隔

  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Indexes
export const projectsOrganizationIdx = index("projects_organization_idx").on(
  projects.organizationId
);
export const projectsSlugIdx = index("projects_slug_idx").on(projects.slug);
export const projectsStatusIdx = index("projects_status_idx").on(
  projects.status
);
export const projectsVisibilityIdx = index("projects_visibility_idx").on(
  projects.visibility
);
export const projectsAiModelIdx = index("projects_ai_model_preference_idx").on(
  projects.aiModelPreference
);

// Relations
export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
}));

// Zod Schemas
export const insertProjectSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/),
  displayName: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  repositoryUrl: z.string().url().optional(),
  visibility: ProjectVisibilityEnum.optional(),
  status: ProjectStatusEnum.optional(),
  defaultBranch: z.string().max(100).optional(),
  enableCiCd: z.boolean().optional(),
  enableAiAssistant: z.boolean().optional(),
  enableMonitoring: z.boolean().optional(),
  aiModelPreference: z.string().max(50).optional(),
  aiAutoReview: z.boolean().optional(),
  aiCostOptimization: z.boolean().optional(),
  maxComputeUnits: z.number().int().min(1).max(10000).optional(),
  maxStorageGb: z.number().int().min(1).max(10000).optional(),
  maxMonthlyCost: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  currentComputeUnits: z.number().int().min(0).optional(),
  currentStorageGb: z.number().int().min(0).optional(),
  currentMonthlyCost: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  primaryTag: z.string().max(50).optional(),
  secondaryTags: z.string().max(200).optional(),
  isArchived: z.boolean().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectProjectSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  displayName: z.string().nullable(),
  description: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  visibility: ProjectVisibilityEnum.nullable(),
  status: ProjectStatusEnum.nullable(),
  defaultBranch: z.string().nullable(),
  enableCiCd: z.boolean().nullable(),
  enableAiAssistant: z.boolean().nullable(),
  enableMonitoring: z.boolean().nullable(),
  aiModelPreference: z.string().nullable(),
  aiAutoReview: z.boolean().nullable(),
  aiCostOptimization: z.boolean().nullable(),
  maxComputeUnits: z.number().int().nullable(),
  maxStorageGb: z.number().int().nullable(),
  maxMonthlyCost: z.string().nullable(),
  currentComputeUnits: z.number().int().nullable(),
  currentStorageGb: z.number().int().nullable(),
  currentMonthlyCost: z.string().nullable(),
  primaryTag: z.string().nullable(),
  secondaryTags: z.string().nullable(),
  isArchived: z.boolean().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const updateProjectSchema = selectProjectSchema
  .pick({
    organizationId: true,
    name: true,
    slug: true,
    displayName: true,
    description: true,
    repositoryUrl: true,
    visibility: true,
    status: true,
    defaultBranch: true,
    enableCiCd: true,
    enableAiAssistant: true,
    enableMonitoring: true,
    aiModelPreference: true,
    aiAutoReview: true,
    aiCostOptimization: true,
    maxComputeUnits: true,
    maxStorageGb: true,
    maxMonthlyCost: true,
    currentComputeUnits: true,
    currentStorageGb: true,
    currentMonthlyCost: true,
    primaryTag: true,
    secondaryTags: true,
    isArchived: true,
  })
  .partial();

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>;
export type ProjectVisibility = z.infer<typeof ProjectVisibilityEnum>;
