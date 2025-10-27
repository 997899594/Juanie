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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { projects } from "./projects.schema";

// 枚举定义
export const ConfigSourceEnum = z.enum(["repository", "ui", "api", "template"]);
export const TriggerTypeEnum = z.enum([
  "push",
  "pull_request",
  "schedule",
  "manual",
  "webhook",
]);
export const ConfigSourcePgEnum = pgEnum("config_source", [
  "repository",
  "ui",
  "api",
  "template",
]);

export const pipelines = pgTable("pipelines", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  repositoryId: uuid("repository_id"),
  name: text("name").notNull(),
  description: text("description"),
  configSource: ConfigSourcePgEnum("config_source").default("repository"),
  configPath: text("config_path").default(".github/workflows/ci.yml"),
  // 简化pipeline_config JSONB字段
  pipelineTimeout: integer("pipeline_timeout").default(3600), // 默认1小时
  maxRetries: integer("max_retries").default(3),
  enableArtifacts: boolean("enable_artifacts").default(true),

  // 简化triggers JSONB字段
  triggerOnPush: boolean("trigger_on_push").default(true),
  triggerOnPr: boolean("trigger_on_pr").default(true),
  triggerOnSchedule: boolean("trigger_on_schedule").default(false),
  triggerOnManual: boolean("trigger_on_manual").default(true),

  // 简化trigger_branches JSONB字段
  mainBranch: text("main_branch").default("main"),
  protectedBranches: text("protected_branches").default("main,develop"), // 逗号分隔的分支名

  // 简化trigger_paths JSONB字段
  includePaths: text("include_paths").default("**/*"), // 逗号分隔的路径模式
  excludePaths: text("exclude_paths").default("node_modules/**,.git/**"), // 逗号分隔的排除路径
  aiOptimizationEnabled: boolean("ai_optimization_enabled").default(true),
  autoParallelization: boolean("auto_parallelization").default(false),
  smartCaching: boolean("smart_caching").default(true),
  isActive: boolean("is_active").default(true),
  successRate: decimal("success_rate", { precision: 3, scale: 2 }),
  averageDuration: integer("average_duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Indexes
export const pipelinesProjectIdx = index("pipelines_project_idx").on(
  pipelines.projectId
);
export const pipelinesRepositoryIdx = index("pipelines_repository_idx").on(
  pipelines.repositoryId
);
export const pipelinesActiveIdx = index("pipelines_active_idx").on(
  pipelines.isActive
);
export const pipelinesConfigSourceIdx = index("pipelines_config_source_idx").on(
  pipelines.configSource
);
export const pipelinesProjectNameUnique = uniqueIndex(
  "pipelines_project_name_unique"
).on(pipelines.projectId, pipelines.name);

// Relations
export const pipelinesRelations = relations(pipelines, ({ one }) => ({
  project: one(projects, {
    fields: [pipelines.projectId],
    references: [projects.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertPipelineSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  repositoryId: z.string().uuid().optional(),
  name: z.string(),
  description: z.string().optional(),
  configSource: ConfigSourceEnum.optional(),
  configPath: z.string().optional(),
  pipelineTimeout: z.number().int().optional(),
  maxRetries: z.number().int().optional(),
  enableArtifacts: z.boolean().optional(),
  triggerOnPush: z.boolean().optional(),
  triggerOnPr: z.boolean().optional(),
  triggerOnSchedule: z.boolean().optional(),
  triggerOnManual: z.boolean().optional(),
  mainBranch: z.string().optional(),
  protectedBranches: z.string().optional(),
  includePaths: z.string().optional(),
  excludePaths: z.string().optional(),
  aiOptimizationEnabled: z.boolean().optional(),
  autoParallelization: z.boolean().optional(),
  smartCaching: z.boolean().optional(),
  isActive: z.boolean().optional(),
  successRate: z.string().optional(),
  averageDuration: z.number().int().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectPipelineSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  repositoryId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  configSource: ConfigSourceEnum.nullable(),
  configPath: z.string().nullable(),
  pipelineTimeout: z.number().int().nullable(),
  maxRetries: z.number().int().nullable(),
  enableArtifacts: z.boolean().nullable(),
  triggerOnPush: z.boolean().nullable(),
  triggerOnPr: z.boolean().nullable(),
  triggerOnSchedule: z.boolean().nullable(),
  triggerOnManual: z.boolean().nullable(),
  mainBranch: z.string().nullable(),
  protectedBranches: z.string().nullable(),
  includePaths: z.string().nullable(),
  excludePaths: z.string().nullable(),
  aiOptimizationEnabled: z.boolean().nullable(),
  autoParallelization: z.boolean().nullable(),
  smartCaching: z.boolean().nullable(),
  isActive: z.boolean().nullable(),
  successRate: z.string().nullable(),
  averageDuration: z.number().int().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const updatePipelineSchema = selectPipelineSchema
  .pick({
    projectId: true,
    repositoryId: true,
    name: true,
    description: true,
    configSource: true,
    configPath: true,
    pipelineTimeout: true,
    maxRetries: true,
    enableArtifacts: true,
    triggerOnPush: true,
    triggerOnPr: true,
    triggerOnSchedule: true,
    triggerOnManual: true,
    mainBranch: true,
    protectedBranches: true,
    includePaths: true,
    excludePaths: true,
    aiOptimizationEnabled: true,
    autoParallelization: true,
    smartCaching: true,
    isActive: true,
    successRate: true,
    averageDuration: true,
  })
  .partial();

export type Pipeline = typeof pipelines.$inferSelect;
export type NewPipeline = typeof pipelines.$inferInsert;
export type UpdatePipeline = z.infer<typeof updatePipelineSchema>;
export type ConfigSource = z.infer<typeof ConfigSourceEnum>;
export type TriggerType = z.infer<typeof TriggerTypeEnum>;
