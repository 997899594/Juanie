import type { infer as Infer, ZodTypeAny } from 'zod';
import type { JuaniePromptKey } from '@/lib/ai/prompts/registry';
import { environmentSummarySchema } from '@/lib/ai/schemas/environment-summary';
import { envvarRiskSchema } from '@/lib/ai/schemas/envvar-risk';
import { incidentAnalysisSchema } from '@/lib/ai/schemas/incident-analysis';
import { migrationReviewSchema } from '@/lib/ai/schemas/migration-review';
import { releasePlanSchema } from '@/lib/ai/schemas/release-plan';

export interface StructuredWorkflowDefinition<TSchema extends ZodTypeAny> {
  pluginId: string;
  promptKey: JuaniePromptKey;
  skillId: string;
  schema: TSchema;
  schemaName: string;
  snapshotSchema: string;
  description: string;
}

export const environmentSummaryWorkflowDefinition = {
  pluginId: 'environment-summary',
  promptKey: 'environment-summary',
  skillId: 'environment-skill',
  schema: environmentSummarySchema,
  schemaName: 'environmentSummary',
  snapshotSchema: 'environment-summary-v1',
  description: 'Juanie 环境摘要',
} satisfies StructuredWorkflowDefinition<typeof environmentSummarySchema>;

export const envvarRiskWorkflowDefinition = {
  pluginId: 'envvar-risk',
  promptKey: 'envvar-risk',
  skillId: 'envvar-skill',
  schema: envvarRiskSchema,
  schemaName: 'envvarRisk',
  snapshotSchema: 'envvar-risk-v1',
  description: 'Juanie 环境变量风险摘要',
} satisfies StructuredWorkflowDefinition<typeof envvarRiskSchema>;

export const incidentAnalysisWorkflowDefinition = {
  pluginId: 'incident-intelligence',
  promptKey: 'incident-analysis',
  skillId: 'incident-skill',
  schema: incidentAnalysisSchema,
  schemaName: 'incidentAnalysis',
  snapshotSchema: 'incident-analysis-v1',
  description: 'Juanie 故障归因分析',
} satisfies StructuredWorkflowDefinition<typeof incidentAnalysisSchema>;

export const migrationReviewWorkflowDefinition = {
  pluginId: 'migration-review',
  promptKey: 'migration-review',
  skillId: 'migration-skill',
  schema: migrationReviewSchema,
  schemaName: 'migrationReview',
  snapshotSchema: 'migration-review-v1',
  description: 'Juanie 环境迁移审阅',
} satisfies StructuredWorkflowDefinition<typeof migrationReviewSchema>;

export const releasePlanWorkflowDefinition = {
  pluginId: 'release-intelligence',
  promptKey: 'release-plan',
  skillId: 'release-skill',
  schema: releasePlanSchema,
  schemaName: 'releasePlan',
  snapshotSchema: 'release-plan-v1',
  description: 'Juanie 发布计划',
} satisfies StructuredWorkflowDefinition<typeof releasePlanSchema>;

const structuredWorkflowDefinitions = [
  environmentSummaryWorkflowDefinition,
  envvarRiskWorkflowDefinition,
  incidentAnalysisWorkflowDefinition,
  migrationReviewWorkflowDefinition,
  releasePlanWorkflowDefinition,
] as const;

export function listStructuredWorkflowDefinitions(): Array<
  StructuredWorkflowDefinition<ZodTypeAny>
> {
  return [...structuredWorkflowDefinitions];
}

export function getStructuredWorkflowDefinitionByPluginId(
  pluginId: string
): StructuredWorkflowDefinition<ZodTypeAny> | null {
  return (
    structuredWorkflowDefinitions.find((definition) => definition.pluginId === pluginId) ?? null
  );
}

export type StructuredWorkflowOutput<TDefinition extends StructuredWorkflowDefinition<ZodTypeAny>> =
  Infer<TDefinition['schema']>;
