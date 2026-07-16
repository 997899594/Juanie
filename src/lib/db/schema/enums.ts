import { pgEnum } from 'drizzle-orm/pg-core';

// ============================================
// Enums
// ============================================

export const gitProviderTypes = ['github', 'gitlab', 'gitlab-self-hosted'] as const;
export type GitProviderType = (typeof gitProviderTypes)[number];

export const serviceTypes = ['web', 'worker', 'cron'] as const;
export type ServiceType = (typeof serviceTypes)[number];

export const databaseTypes = ['postgresql', 'mysql', 'redis', 'mongodb'] as const;
export type DatabaseType = (typeof databaseTypes)[number];

export const databasePlans = ['starter', 'standard', 'premium'] as const;
export type DatabasePlan = (typeof databasePlans)[number];

export const databaseScopes = ['project', 'service'] as const;
export type DatabaseScope = (typeof databaseScopes)[number];

export const databaseRoles = ['primary', 'readonly', 'cache', 'queue', 'analytics'] as const;
export type DatabaseRole = (typeof databaseRoles)[number];
export const databaseRuntimes = [
  'external',
  'shared_postgres',
  'shared_redis',
  'cloudnativepg',
  'native_k8s',
] as const;
export type DatabaseRuntime = (typeof databaseRuntimes)[number];

export const projectStatuses = [
  'initializing',
  'active',
  'failed',
  'deleting',
  'archived',
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const releaseStatuses = [
  'admission_running',
  'admission_failed',
  'queued',
  'planning',
  'migration_pre_running',
  'awaiting_approval',
  'awaiting_external_completion',
  'migration_pre_failed',
  'deploying',
  'awaiting_rollout',
  'verifying',
  'verification_failed',
  'migration_post_running',
  'degraded',
  'succeeded',
  'failed',
  'canceled',
] as const;
export type ReleaseStatus = (typeof releaseStatuses)[number];

export const releaseArtifactKinds = ['image', 'package', 'baremetal', 'archive'] as const;
export type ReleaseArtifactKind = (typeof releaseArtifactKinds)[number];

export const releaseArtifactStatuses = ['pending', 'building', 'succeeded', 'failed'] as const;
export type ReleaseArtifactStatus = (typeof releaseArtifactStatuses)[number];

export const buildRunStatuses = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'finalizing',
  'finalized',
] as const;
export type BuildRunStatus = (typeof buildRunStatuses)[number];

export const buildUnitStatuses = ['pending', 'running', 'succeeded', 'failed'] as const;
export type BuildUnitStatus = (typeof buildUnitStatuses)[number];

export const buildArtifactKinds = ['image', 'package', 'static', 'function'] as const;
export type BuildArtifactKind = (typeof buildArtifactKinds)[number];

export const deploymentStatuses = [
  'queued',
  'migration_pending',
  'migration_running',
  'migration_failed',
  'building',
  'deploying',
  'awaiting_rollout',
  'verification_failed',
  'running',
  'canceled',
  'failed',
  'rolled_back',
] as const;
export type DeploymentStatus = (typeof deploymentStatuses)[number];

export const migrationTools = [
  'atlas',
  'drizzle',
  'prisma',
  'knex',
  'typeorm',
  'sql',
  'custom',
] as const;
export type MigrationTool = (typeof migrationTools)[number];

export const migrationPhases = ['preDeploy', 'postDeploy', 'manual'] as const;
export type MigrationPhase = (typeof migrationPhases)[number];

export const migrationReleaseStages = [
  'standard',
  'expand',
  'backfill',
  'verify',
  'contract',
] as const;
export type MigrationReleaseStage = (typeof migrationReleaseStages)[number];

export const migrationExecutionModes = ['automatic', 'manual_platform', 'external'] as const;
export type MigrationExecutionMode = (typeof migrationExecutionModes)[number];

export const migrationRunStatuses = [
  'queued',
  'awaiting_approval',
  'awaiting_external_completion',
  'planning',
  'running',
  'success',
  'failed',
  'canceled',
  'skipped',
] as const;
export type MigrationRunStatus = (typeof migrationRunStatuses)[number];

export const migrationRunnerTypes = ['worker', 'schema_runner', 'external'] as const;
export type MigrationRunnerType = (typeof migrationRunnerTypes)[number];

export const migrationLockStrategies = ['platform', 'db_advisory'] as const;
export type MigrationLockStrategy = (typeof migrationLockStrategies)[number];

export const migrationCompatibilities = ['backward_compatible', 'breaking'] as const;
export type MigrationCompatibility = (typeof migrationCompatibilities)[number];

export const migrationApprovalPolicies = ['auto', 'manual_in_production'] as const;
export type MigrationApprovalPolicy = (typeof migrationApprovalPolicies)[number];

export const releaseMigrationPlanStatuses = [
  'awaiting_approval',
  'approved',
  'executing',
  'completed',
  'failed',
  'superseded',
] as const;
export type ReleaseMigrationPlanStatus = (typeof releaseMigrationPlanStatuses)[number];

export interface MigrationSpecificationSnapshot {
  source: MigrationTool;
  tool: MigrationTool;
  phase: MigrationPhase;
  executionMode: MigrationExecutionMode;
  releaseStage: MigrationReleaseStage;
  stageOrder: number;
  targetVersion: string | null;
  baselineVersion: string | null;
  sourceConfigPath: string | null;
  migrationPath: string | null;
  command: string;
  lockStrategy: MigrationLockStrategy;
  compatibility: MigrationCompatibility;
  approvalPolicy: MigrationApprovalPolicy;
}

export const initStepStatuses = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;
export type InitStepStatus = (typeof initStepStatuses)[number];

export const environmentDeploymentStrategies = [
  'rolling',
  'controlled',
  'canary',
  'blue_green',
] as const;
export type EnvironmentDeploymentStrategy = (typeof environmentDeploymentStrategies)[number];
export const environmentDeploymentRuntimes = ['native_k8s', 'argo_rollouts'] as const;
export type EnvironmentDeploymentRuntime = (typeof environmentDeploymentRuntimes)[number];
export const environmentKinds = ['production', 'persistent', 'preview'] as const;
export type EnvironmentKind = (typeof environmentKinds)[number];
export const environmentDeliveryModes = ['direct', 'promote_only'] as const;
export type EnvironmentDeliveryMode = (typeof environmentDeliveryModes)[number];
export const environmentDatabaseStrategies = ['direct', 'inherit', 'isolated_clone'] as const;
export type EnvironmentDatabaseStrategy = (typeof environmentDatabaseStrategies)[number];
export const deliveryRuleKinds = ['branch', 'tag', 'pull_request', 'manual'] as const;
export type DeliveryRuleKind = (typeof deliveryRuleKinds)[number];
export const promotionFlowStrategies = ['reuse_release_artifacts', 'rebuild_from_ref'] as const;
export type PromotionFlowStrategy = (typeof promotionFlowStrategies)[number];
export const environmentSchemaStateStatuses = [
  'aligned',
  'pending_migrations',
  'aligned_untracked',
  'drifted',
  'unmanaged',
  'blocked',
] as const;
export type EnvironmentSchemaStateStatus = (typeof environmentSchemaStateStatuses)[number];
export const schemaRepairPlanKinds = [
  'no_action',
  'run_release_migrations',
  'mark_aligned',
  'repair_pr_required',
  'adopt_current_db',
  'manual_investigation',
] as const;
export type SchemaRepairPlanKind = (typeof schemaRepairPlanKinds)[number];
export const schemaRepairPlanStatuses = [
  'draft',
  'review_opened',
  'applied',
  'superseded',
  'failed',
] as const;
export type SchemaRepairPlanStatus = (typeof schemaRepairPlanStatuses)[number];
export const schemaRepairReviewStates = ['draft', 'open', 'merged', 'closed', 'unknown'] as const;
export type SchemaRepairReviewState = (typeof schemaRepairReviewStates)[number];
export const atlasExecutionStatuses = ['idle', 'queued', 'running', 'succeeded', 'failed'] as const;
export type AtlasExecutionStatus = (typeof atlasExecutionStatuses)[number];

export const aiPlans = ['free', 'pro', 'scale', 'enterprise'] as const;
export type AIPlan = (typeof aiPlans)[number];

export const aiPluginRunStatuses = ['succeeded', 'failed'] as const;
export type AIPluginRunStatus = (typeof aiPluginRunStatuses)[number];

export const outboxStatuses = [
  'pending',
  'dispatching',
  'delivered',
  'failed',
  'dead_letter',
] as const;
export type OutboxStatus = (typeof outboxStatuses)[number];
export const aiTaskKinds = ['environment_deep_analysis', 'release_deep_analysis'] as const;
export type AITaskKind = (typeof aiTaskKinds)[number];
export const aiTaskStatuses = ['queued', 'running', 'succeeded', 'failed'] as const;
export type AITaskStatus = (typeof aiTaskStatuses)[number];

export const teamRoles = ['owner', 'admin', 'member', 'delivery'] as const;
export type TeamRole = (typeof teamRoles)[number];
export const platformRoles = ['user', 'operator'] as const;
export type PlatformRole = (typeof platformRoles)[number];

export const integrationCapabilities = [
  'read_repo',
  'write_repo',
  'write_workflow',
  'manage_webhook',
] as const;
export type IntegrationCapability = (typeof integrationCapabilities)[number];
export const integrationAuthModes = ['personal', 'service'] as const;
export type IntegrationAuthMode = (typeof integrationAuthModes)[number];

export const gitProviderTypeEnum = pgEnum('gitProviderType', gitProviderTypes);
export const serviceTypeEnum = pgEnum('serviceType', serviceTypes);
export const databaseTypeEnum = pgEnum('databaseType', databaseTypes);
export const databasePlanEnum = pgEnum('databasePlan', databasePlans);
export const databaseScopeEnum = pgEnum('databaseScope', databaseScopes);
export const databaseRoleEnum = pgEnum('databaseRole', databaseRoles);
export const databaseRuntimeEnum = pgEnum('databaseRuntime', databaseRuntimes);
export const projectStatusEnum = pgEnum('projectStatus', projectStatuses);
export const releaseStatusEnum = pgEnum('releaseStatus', releaseStatuses);
export const buildRunStatusEnum = pgEnum('buildRunStatus', buildRunStatuses);
export const buildUnitStatusEnum = pgEnum('buildUnitStatus', buildUnitStatuses);
export const buildArtifactKindEnum = pgEnum('buildArtifactKind', buildArtifactKinds);
export const deploymentStatusEnum = pgEnum('deploymentStatus', deploymentStatuses);
export const initStepStatusEnum = pgEnum('initStepStatus', initStepStatuses);
export const teamRoleEnum = pgEnum('teamRole', teamRoles);
export const platformRoleEnum = pgEnum('platformRole', platformRoles);
export const integrationCapabilityEnum = pgEnum('integrationCapability', integrationCapabilities);
export const integrationAuthModeEnum = pgEnum('integrationAuthMode', integrationAuthModes);
export const aiPlanEnum = pgEnum('aiPlan', aiPlans);
export const aiTaskKindEnum = pgEnum('aiTaskKind', aiTaskKinds);
export const aiTaskStatusEnum = pgEnum('aiTaskStatus', aiTaskStatuses);
export const migrationToolEnum = pgEnum('migrationTool', migrationTools);
export const migrationPhaseEnum = pgEnum('migrationPhase', migrationPhases);
export const migrationReleaseStageEnum = pgEnum('migrationReleaseStage', migrationReleaseStages);
export const migrationExecutionModeEnum = pgEnum('migrationExecutionMode', migrationExecutionModes);
export const migrationRunStatusEnum = pgEnum('migrationRunStatus', migrationRunStatuses);
export const migrationRunnerTypeEnum = pgEnum('migrationRunnerType', migrationRunnerTypes);
export const migrationLockStrategyEnum = pgEnum('migrationLockStrategy', migrationLockStrategies);
export const migrationCompatibilityEnum = pgEnum(
  'migrationCompatibility',
  migrationCompatibilities
);
export const migrationApprovalPolicyEnum = pgEnum(
  'migrationApprovalPolicy',
  migrationApprovalPolicies
);
export const releaseMigrationPlanStatusEnum = pgEnum(
  'releaseMigrationPlanStatus',
  releaseMigrationPlanStatuses
);
export const environmentDeploymentStrategyEnum = pgEnum(
  'environmentDeploymentStrategy',
  environmentDeploymentStrategies
);
export const environmentDeploymentRuntimeEnum = pgEnum(
  'environmentDeploymentRuntime',
  environmentDeploymentRuntimes
);
export const environmentKindEnum = pgEnum('environmentKind', environmentKinds);
export const environmentDeliveryModeEnum = pgEnum(
  'environmentDeliveryMode',
  environmentDeliveryModes
);
export const environmentDatabaseStrategyEnum = pgEnum(
  'environmentDatabaseStrategy',
  environmentDatabaseStrategies
);
export const deliveryRuleKindEnum = pgEnum('deliveryRuleKind', deliveryRuleKinds);
export const promotionFlowStrategyEnum = pgEnum('promotionFlowStrategy', promotionFlowStrategies);
export const environmentSchemaStateStatusEnum = pgEnum(
  'environmentSchemaStateStatus',
  environmentSchemaStateStatuses
);
export const schemaRepairPlanKindEnum = pgEnum('schemaRepairPlanKind', schemaRepairPlanKinds);
export const schemaRepairPlanStatusEnum = pgEnum(
  'schemaRepairPlanStatus',
  schemaRepairPlanStatuses
);
export const schemaRepairReviewStateEnum = pgEnum(
  'schemaRepairReviewState',
  schemaRepairReviewStates
);
export const atlasExecutionStatusEnum = pgEnum('atlasExecutionStatus', atlasExecutionStatuses);
export const aiPluginRunStatusEnum = pgEnum('aiPluginRunStatus', aiPluginRunStatuses);
export const outboxStatusEnum = pgEnum('outboxStatus', outboxStatuses);
