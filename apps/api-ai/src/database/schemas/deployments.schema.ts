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
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { environments } from "./environments.schema";
import { pipelineRuns } from "./pipeline-runs.schema";
import { projects } from "./projects.schema";
import { users } from "./users.schema";

// 枚举定义
export const DeploymentStatusEnum = z.enum([
  "pending",
  "running",
  "success",
  "failed",
  "cancelled",
  "rolled_back",
]);
export const DeploymentStrategyEnum = z.enum([
  "rolling",
  "blue_green",
  "canary",
  "recreate",
  "a_b_testing",
]);
export const RollbackStrategyEnum = z.enum([
  "automatic",
  "manual",
  "conditional",
]);

// 使用 pgEnum 管理枚举类型（DB 级）
export const DeploymentStatusPgEnum = pgEnum("deployment_status", [
  "pending",
  "running",
  "success",
  "failed",
  "cancelled",
  "rolled_back",
]);
export const DeploymentStrategyPgEnum = pgEnum("deployment_strategy", [
  "rolling",
  "blue_green",
  "canary",
  "recreate",
  "a_b_testing",
]);
export const RollbackStrategyPgEnum = pgEnum("rollback_strategy", [
  "automatic",
  "manual",
  "conditional",
]);

export const deployments = pgTable("deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environments.id),
  pipelineRunId: uuid("pipeline_run_id").references(() => pipelineRuns.id),
  version: text("version").notNull(),
  commitHash: text("commit_hash").notNull(),
  commitMessage: text("commit_message"),
  branch: text("branch").notNull(),
  deploymentStrategy: DeploymentStrategyPgEnum("deployment_strategy").default(
    "rolling"
  ),
  rollbackStrategy:
    RollbackStrategyPgEnum("rollback_strategy").default("manual"),
  status: DeploymentStatusPgEnum("status").default("pending"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  deployedBy: uuid("deployed_by").references(() => users.id),
  approvedBy: uuid("approved_by").references(() => users.id),
  successProbability: decimal("success_probability", {
    precision: 3,
    scale: 2,
  }),

  // 简化 riskAssessment - 核心风险评估
  riskLevel: text("risk_level"), // 风险等级：low, medium, high
  riskScore: integer("risk_score"), // 风险评分：0-100
  riskFactors: text("risk_factors"), // 风险因素（逗号分隔）

  // 简化 performancePrediction - 核心性能预测
  predictedResponseTime: integer("predicted_response_time"), // 预测响应时间
  predictedThroughput: integer("predicted_throughput"), // 预测吞吐量
  predictedAvailability: decimal("predicted_availability", {
    precision: 5,
    scale: 2,
  }), // 预测可用性

  // 简化 performanceMetrics - 核心性能指标
  avgResponseTime: integer("avg_response_time"), // 平均响应时间
  throughputRps: integer("throughput_rps"), // 吞吐量（请求/秒）
  availability: decimal("availability", { precision: 5, scale: 2 }), // 可用性

  errorRate: decimal("error_rate", { precision: 5, scale: 4 }),
  responseTimeP95: integer("response_time_p95"),
  deploymentCost: decimal("deployment_cost", { precision: 10, scale: 2 }),

  // 简化 resourceUsage - 核心资源使用
  cpuUsageAvg: decimal("cpu_usage_avg", { precision: 5, scale: 2 }), // CPU使用率
  memoryUsageAvg: decimal("memory_usage_avg", { precision: 5, scale: 2 }), // 内存使用率
  diskUsageGb: decimal("disk_usage_gb", { precision: 8, scale: 2 }), // 磁盘使用（GB）
  carbonFootprint: decimal("carbon_footprint", { precision: 8, scale: 3 }),
  rollbackReason: text("rollback_reason"),
  rolledBackAt: timestamp("rolled_back_at"),
  rollbackDuration: integer("rollback_duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Indexes
export const deploymentsProjectIdx = index("deployments_project_idx").on(
  deployments.projectId
);
export const deploymentsEnvironmentIdx = index(
  "deployments_environment_idx"
).on(deployments.environmentId);
export const deploymentsStatusIdx = index("deployments_status_idx").on(
  deployments.status
);
export const deploymentsDeployedByIdx = index("deployments_deployed_by_idx").on(
  deployments.deployedBy
);

// Relations
export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [deployments.environmentId],
    references: [environments.id],
  }),
  deployedByUser: one(users, {
    fields: [deployments.deployedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [deployments.approvedBy],
    references: [users.id],
  }),
}));

// Zod Schemas - 手动维护
export const insertDeploymentSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid(),
  pipelineRunId: z.string().uuid().optional(),
  version: z.string(),
  commitHash: z.string(),
  commitMessage: z.string().optional(),
  branch: z.string(),
  deploymentStrategy: DeploymentStrategyEnum.optional(),
  rollbackStrategy: RollbackStrategyEnum.optional(),
  status: DeploymentStatusEnum.optional(),
  startedAt: z.date().optional(),
  finishedAt: z.date().optional(),
  deployedBy: z.string().uuid().optional(),
  approvedBy: z.string().uuid().optional(),
  successProbability: z.string().optional(),
  riskLevel: z.string().optional(),
  riskScore: z.number().optional(),
  riskFactors: z.string().optional(),
  predictedResponseTime: z.number().optional(),
  predictedThroughput: z.number().optional(),
  predictedAvailability: z.string().optional(),
  avgResponseTime: z.number().optional(),
  throughputRps: z.number().optional(),
  availability: z.string().optional(),
  errorRate: z.string().optional(),
  responseTimeP95: z.number().optional(),
  deploymentCost: z.string().optional(),
  cpuUsageAvg: z.string().optional(),
  memoryUsageAvg: z.string().optional(),
  diskUsageGb: z.string().optional(),
  carbonFootprint: z.string().optional(),
  rollbackReason: z.string().optional(),
  rolledBackAt: z.date().optional(),
  rollbackDuration: z.number().optional(),
});

export const selectDeploymentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  environmentId: z.string().uuid(),
  pipelineRunId: z.string().uuid().nullable(),
  version: z.string(),
  commitHash: z.string(),
  commitMessage: z.string().nullable(),
  branch: z.string(),
  deploymentStrategy: DeploymentStrategyEnum.nullable(),
  rollbackStrategy: RollbackStrategyEnum.nullable(),
  status: DeploymentStatusEnum.nullable(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  deployedBy: z.string().uuid().nullable(),
  approvedBy: z.string().uuid().nullable(),
  successProbability: z.string().nullable(),
  riskLevel: z.string().nullable(),
  riskScore: z.number().nullable(),
  riskFactors: z.string().nullable(),
  predictedResponseTime: z.number().nullable(),
  predictedThroughput: z.number().nullable(),
  predictedAvailability: z.string().nullable(),
  avgResponseTime: z.number().nullable(),
  throughputRps: z.number().nullable(),
  availability: z.string().nullable(),
  errorRate: z.string().nullable(),
  responseTimeP95: z.number().nullable(),
  deploymentCost: z.string().nullable(),
  cpuUsageAvg: z.string().nullable(),
  memoryUsageAvg: z.string().nullable(),
  diskUsageGb: z.string().nullable(),
  carbonFootprint: z.string().nullable(),
  rollbackReason: z.string().nullable(),
  rolledBackAt: z.date().nullable(),
  rollbackDuration: z.number().nullable(),
  createdAt: z.date(),
});

export const updateDeploymentSchema = selectDeploymentSchema
  .pick({
    projectId: true,
    environmentId: true,
    pipelineRunId: true,
    version: true,
    commitHash: true,
    commitMessage: true,
    branch: true,
    deploymentStrategy: true,
    rollbackStrategy: true,
    status: true,
    startedAt: true,
    finishedAt: true,
    deployedBy: true,
    approvedBy: true,
    successProbability: true,
    riskLevel: true,
    riskScore: true,
    riskFactors: true,
    predictedResponseTime: true,
    predictedThroughput: true,
    predictedAvailability: true,
    avgResponseTime: true,
    throughputRps: true,
    availability: true,
    errorRate: true,
    responseTimeP95: true,
    deploymentCost: true,
    cpuUsageAvg: true,
    memoryUsageAvg: true,
    diskUsageGb: true,
    carbonFootprint: true,
    rollbackReason: true,
    rolledBackAt: true,
    rollbackDuration: true,
  })
  .partial();

export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type UpdateDeployment = z.infer<typeof updateDeploymentSchema>;
export type DeploymentStatus = z.infer<typeof DeploymentStatusEnum>;
export type DeploymentStrategy = z.infer<typeof DeploymentStrategyEnum>;
export type RollbackStrategy = z.infer<typeof RollbackStrategyEnum>;
