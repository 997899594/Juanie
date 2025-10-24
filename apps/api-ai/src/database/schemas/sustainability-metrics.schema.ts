import { relations } from "drizzle-orm";
import {
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { deployments } from "./deployments.schema";
import { environments } from "./environments.schema";
import { projects } from "./projects.schema";

export const sustainabilityMetrics = pgTable("sustainability_metrics", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  environmentId: integer("environment_id").references(() => environments.id),
  deploymentId: integer("deployment_id").references(() => deployments.id),

  // 能源消耗
  energyConsumptionKwh: decimal("energy_consumption_kwh", {
    precision: 10,
    scale: 4,
  }), // 千瓦时
  renewableEnergyPercentage: decimal("renewable_energy_percentage", {
    precision: 5,
    scale: 2,
  }), // 可再生能源占比

  // 碳排放
  carbonEmissionsKg: decimal("carbon_emissions_kg", {
    precision: 10,
    scale: 4,
  }), // 公斤CO2当量
  carbonIntensity: decimal("carbon_intensity", { precision: 10, scale: 6 }), // 每单位计算的碳排放

  // 效率指标
  computeEfficiencyScore: decimal("compute_efficiency_score", {
    precision: 3,
    scale: 2,
  }), // 计算效率评分
  resourceUtilization: decimal("resource_utilization", {
    precision: 5,
    scale: 2,
  }), // 资源利用率

  // 优化建议
  greenOptimizationSuggestions: jsonb("green_optimization_suggestions").default(
    []
  ),
  estimatedEmissionReduction: decimal("estimated_emission_reduction", {
    precision: 10,
    scale: 4,
  }),

  // 认证和标准
  greenCertifications: jsonb("green_certifications").default([]),
  sustainabilityScore: decimal("sustainability_score", {
    precision: 3,
    scale: 2,
  }),

  measurementPeriodStart: timestamp("measurement_period_start").notNull(),
  measurementPeriodEnd: timestamp("measurement_period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Indexes
export const sustainabilityMetricsProjectIdx = index(
  "sustainability_metrics_project_idx"
).on(sustainabilityMetrics.projectId);
export const sustainabilityMetricsEnvironmentIdx = index(
  "sustainability_metrics_environment_idx"
).on(sustainabilityMetrics.environmentId);
export const sustainabilityMetricsDeploymentIdx = index(
  "sustainability_metrics_deployment_idx"
).on(sustainabilityMetrics.deploymentId);
export const sustainabilityMetricsPeriodIdx = index(
  "sustainability_metrics_period_idx"
).on(
  sustainabilityMetrics.measurementPeriodStart,
  sustainabilityMetrics.measurementPeriodEnd
);

// Relations
export const sustainabilityMetricsRelations = relations(
  sustainabilityMetrics,
  ({ one }) => ({
    project: one(projects, {
      fields: [sustainabilityMetrics.projectId],
      references: [projects.id],
    }),
    environment: one(environments, {
      fields: [sustainabilityMetrics.environmentId],
      references: [environments.id],
    }),
    deployment: one(deployments, {
      fields: [sustainabilityMetrics.deploymentId],
      references: [deployments.id],
    }),
  })
);

// Zod Schemas
export const insertSustainabilityMetricSchema = createInsertSchema(
  sustainabilityMetrics
);

export const selectSustainabilityMetricSchema = createSelectSchema(
  sustainabilityMetrics
);

export const updateSustainabilityMetricSchema = selectSustainabilityMetricSchema
  .pick({
    projectId: true,
    environmentId: true,
    deploymentId: true,
    energyConsumptionKwh: true,
    renewableEnergyPercentage: true,
    carbonEmissionsKg: true,
    carbonIntensity: true,
    computeEfficiencyScore: true,
    resourceUtilization: true,
    greenOptimizationSuggestions: true,
    estimatedEmissionReduction: true,
    greenCertifications: true,
    sustainabilityScore: true,
    measurementPeriodStart: true,
    measurementPeriodEnd: true,
  })
  .partial();

export type SustainabilityMetric = typeof sustainabilityMetrics.$inferSelect;
export type NewSustainabilityMetric = typeof sustainabilityMetrics.$inferInsert;
export type UpdateSustainabilityMetric = z.infer<
  typeof updateSustainabilityMetricSchema
>;
