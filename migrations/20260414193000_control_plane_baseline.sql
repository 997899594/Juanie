CREATE TYPE "public"."aiPlan" AS ENUM('free', 'pro', 'scale', 'enterprise');
CREATE TYPE "public"."aiPluginRunStatus" AS ENUM('succeeded', 'failed');
CREATE TYPE "public"."atlasExecutionStatus" AS ENUM('idle', 'queued', 'running', 'succeeded', 'failed');
CREATE TYPE "public"."databasePlan" AS ENUM('starter', 'standard', 'premium');
CREATE TYPE "public"."databaseRole" AS ENUM('primary', 'readonly', 'cache', 'queue', 'analytics');
CREATE TYPE "public"."databaseScope" AS ENUM('project', 'service');
CREATE TYPE "public"."databaseType" AS ENUM('postgresql', 'mysql', 'redis', 'mongodb');
CREATE TYPE "public"."deploymentStatus" AS ENUM('queued', 'migration_pending', 'migration_running', 'migration_failed', 'building', 'deploying', 'awaiting_rollout', 'verification_failed', 'running', 'canceled', 'failed', 'rolled_back');
CREATE TYPE "public"."environmentDatabaseStrategy" AS ENUM('direct', 'inherit', 'isolated_clone');
CREATE TYPE "public"."environmentDeploymentStrategy" AS ENUM('rolling', 'controlled', 'canary', 'blue_green');
CREATE TYPE "public"."environmentSchemaStateStatus" AS ENUM('aligned', 'pending_migrations', 'aligned_untracked', 'drifted', 'unmanaged', 'blocked');
CREATE TYPE "public"."gitProviderType" AS ENUM('github', 'gitlab', 'gitlab-self-hosted');
CREATE TYPE "public"."initStepStatus" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');
CREATE TYPE "public"."integrationAuthMode" AS ENUM('personal', 'service');
CREATE TYPE "public"."integrationCapability" AS ENUM('read_repo', 'write_repo', 'write_workflow');
CREATE TYPE "public"."migrationApprovalPolicy" AS ENUM('auto', 'manual_in_production');
CREATE TYPE "public"."migrationCompatibility" AS ENUM('backward_compatible', 'breaking');
CREATE TYPE "public"."migrationExecutionMode" AS ENUM('automatic', 'manual_platform', 'external');
CREATE TYPE "public"."migrationLockStrategy" AS ENUM('platform', 'db_advisory');
CREATE TYPE "public"."migrationPhase" AS ENUM('preDeploy', 'postDeploy', 'manual');
CREATE TYPE "public"."migrationRunStatus" AS ENUM('queued', 'awaiting_approval', 'awaiting_external_completion', 'planning', 'running', 'success', 'failed', 'canceled', 'skipped');
CREATE TYPE "public"."migrationRunnerType" AS ENUM('k8s_job', 'ci_job', 'worker');
CREATE TYPE "public"."migrationTool" AS ENUM('drizzle', 'prisma', 'knex', 'typeorm', 'sql', 'custom');
CREATE TYPE "public"."projectStatus" AS ENUM('initializing', 'active', 'failed', 'archived');
CREATE TYPE "public"."releaseStatus" AS ENUM('queued', 'planning', 'migration_pre_running', 'awaiting_approval', 'awaiting_external_completion', 'migration_pre_failed', 'deploying', 'awaiting_rollout', 'verifying', 'verification_failed', 'migration_post_running', 'degraded', 'succeeded', 'failed', 'canceled');
CREATE TYPE "public"."schemaRepairPlanKind" AS ENUM('no_action', 'run_release_migrations', 'mark_aligned', 'repair_pr_required', 'adopt_current_db', 'manual_investigation');
CREATE TYPE "public"."schemaRepairPlanStatus" AS ENUM('draft', 'review_opened', 'applied', 'superseded', 'failed');
CREATE TYPE "public"."schemaRepairReviewState" AS ENUM('draft', 'open', 'merged', 'closed', 'unknown');
CREATE TYPE "public"."serviceType" AS ENUM('web', 'worker', 'cron');
CREATE TYPE "public"."teamRole" AS ENUM('owner', 'admin', 'member');
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);

CREATE TABLE "aiEntitlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"pluginId" varchar(100) DEFAULT '*' NOT NULL,
	"plan" "aiPlan" DEFAULT 'free' NOT NULL,
	"isEnabled" boolean DEFAULT true NOT NULL,
	"startsAt" timestamp,
	"endsAt" timestamp,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aiEntitlement_team_plugin_unique" UNIQUE("teamId","pluginId")
);

CREATE TABLE "aiPluginInstallation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"pluginId" varchar(100) NOT NULL,
	"isEnabled" boolean DEFAULT true NOT NULL,
	"installedByUserId" uuid,
	"config" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aiPluginInstallation_team_plugin_unique" UNIQUE("teamId","pluginId")
);

CREATE TABLE "aiPluginRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pluginId" varchar(100) NOT NULL,
	"teamId" uuid NOT NULL,
	"projectId" uuid,
	"environmentId" uuid,
	"releaseId" uuid,
	"resourceType" varchar(50) NOT NULL,
	"resourceId" uuid NOT NULL,
	"provider" varchar(100),
	"model" varchar(255),
	"inputHash" varchar(64),
	"status" "aiPluginRunStatus" DEFAULT 'succeeded' NOT NULL,
	"latencyMs" integer,
	"degradedReason" varchar(100),
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "aiPluginSnapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pluginId" varchar(100) NOT NULL,
	"teamId" uuid NOT NULL,
	"projectId" uuid,
	"environmentId" uuid,
	"releaseId" uuid,
	"resourceType" varchar(50) NOT NULL,
	"resourceId" uuid NOT NULL,
	"schemaVersion" varchar(100) NOT NULL,
	"inputHash" varchar(64) NOT NULL,
	"provider" varchar(100),
	"model" varchar(255),
	"degradedReason" varchar(100),
	"output" jsonb NOT NULL,
	"generatedAt" timestamp DEFAULT now() NOT NULL,
	"lastAccessedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aiPluginSnapshot_schema_input_unique" UNIQUE("pluginId","resourceType","resourceId","schemaVersion","inputHash")
);

CREATE TABLE "auditLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"userId" uuid,
	"action" varchar(100) NOT NULL,
	"resourceType" varchar(100) NOT NULL,
	"resourceId" uuid,
	"metadata" jsonb,
	"ipAddress" varchar(50),
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "databaseMigration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"databaseId" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"output" text,
	"error" text,
	"executedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "databaseMigration_databaseId_filename_unique" UNIQUE("databaseId","filename")
);

CREATE TABLE "database" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"environmentId" uuid,
	"sourceDatabaseId" uuid,
	"serviceId" uuid,
	"name" varchar(255) NOT NULL,
	"type" "databaseType" NOT NULL,
	"plan" "databasePlan" DEFAULT 'starter' NOT NULL,
	"provisionType" varchar(20) DEFAULT 'shared' NOT NULL,
	"scope" "databaseScope" DEFAULT 'project' NOT NULL,
	"role" "databaseRole" DEFAULT 'primary' NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"connectionString" text,
	"host" varchar(255),
	"port" integer,
	"databaseName" varchar(255),
	"username" varchar(255),
	"password" varchar(255),
	"namespace" varchar(100),
	"serviceName" varchar(255),
	"status" varchar(50) DEFAULT 'pending',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "database_environment_source_unique" UNIQUE("environmentId","sourceDatabaseId")
);

CREATE TABLE "deploymentLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deploymentId" uuid NOT NULL,
	"level" varchar(10) DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "deployment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"releaseId" uuid,
	"projectId" uuid NOT NULL,
	"environmentId" uuid NOT NULL,
	"serviceId" uuid,
	"version" varchar(100),
	"status" "deploymentStatus" DEFAULT 'queued' NOT NULL,
	"commitSha" varchar(100),
	"commitMessage" text,
	"branch" varchar(100),
	"imageUrl" varchar(500),
	"buildLogs" text,
	"errorMessage" text,
	"deployedById" uuid,
	"deployedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "domain" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"environmentId" uuid,
	"serviceId" uuid,
	"hostname" varchar(255) NOT NULL,
	"isCustom" boolean DEFAULT false,
	"isVerified" boolean DEFAULT false,
	"verificationCode" varchar(100),
	"tlsEnabled" boolean DEFAULT true,
	"tlsCertArn" varchar(255),
	"lbIpAddress" varchar(50),
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "environmentSchemaState" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"environmentId" uuid NOT NULL,
	"databaseId" uuid NOT NULL,
	"status" "environmentSchemaStateStatus" DEFAULT 'unmanaged' NOT NULL,
	"expectedVersion" varchar(255),
	"actualVersion" varchar(255),
	"expectedChecksum" varchar(64),
	"actualChecksum" varchar(64),
	"hasLedger" boolean DEFAULT false NOT NULL,
	"hasUserTables" boolean DEFAULT false NOT NULL,
	"summary" text,
	"lastInspectedAt" timestamp,
	"lastErrorCode" varchar(100),
	"lastErrorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "environmentSchemaState_database_unique" UNIQUE("databaseId")
);

CREATE TABLE "environmentVariable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"environmentId" uuid,
	"serviceId" uuid,
	"key" varchar(255) NOT NULL,
	"value" text,
	"isSecret" boolean DEFAULT false,
	"injectionType" varchar(20) DEFAULT 'runtime',
	"encryptedValue" text,
	"iv" varchar(64),
	"authTag" varchar(64),
	"referenceType" varchar(50),
	"referenceId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "environment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"branch" varchar(100),
	"tagPattern" varchar(100),
	"isPreview" boolean DEFAULT false,
	"previewPrNumber" integer,
	"expiresAt" timestamp,
	"baseEnvironmentId" uuid,
	"databaseStrategy" "environmentDatabaseStrategy" DEFAULT 'direct' NOT NULL,
	"autoDeploy" boolean DEFAULT true NOT NULL,
	"isProduction" boolean DEFAULT false NOT NULL,
	"deploymentStrategy" "environmentDeploymentStrategy" DEFAULT 'rolling' NOT NULL,
	"namespace" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "gitProvider" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" "gitProviderType" NOT NULL,
	"name" varchar(255) NOT NULL,
	"serverUrl" varchar(500),
	"clientId" varchar(255),
	"clientSecret" varchar(255),
	"accessToken" text,
	"refreshToken" text,
	"tokenExpiresAt" timestamp,
	"externalUserId" varchar(255),
	"username" varchar(255),
	"avatarUrl" varchar(500),
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "integration_capability_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integrationGrantId" uuid NOT NULL,
	"capability" "integrationCapability" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_capability_snapshot_grant_capability_unique" UNIQUE("integrationGrantId","capability")
);

CREATE TABLE "integration_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integrationIdentityId" uuid NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"scopeRaw" text,
	"expiresAt" timestamp,
	"revokedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "integration_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"provider" "gitProviderType" NOT NULL,
	"externalUserId" varchar(255),
	"username" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "migrationRunItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"migrationRunId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"checksum" varchar(64),
	"status" "migrationRunStatus" DEFAULT 'queued' NOT NULL,
	"startedAt" timestamp,
	"finishedAt" timestamp,
	"output" text,
	"error" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "migrationRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"serviceId" uuid NOT NULL,
	"environmentId" uuid NOT NULL,
	"databaseId" uuid NOT NULL,
	"specificationId" uuid NOT NULL,
	"releaseId" uuid,
	"deploymentId" uuid,
	"triggeredBy" varchar(20) NOT NULL,
	"triggeredByUserId" uuid,
	"sourceCommitSha" varchar(100),
	"sourceCommitMessage" text,
	"status" "migrationRunStatus" DEFAULT 'queued' NOT NULL,
	"runnerType" "migrationRunnerType" DEFAULT 'worker' NOT NULL,
	"lockKey" varchar(255) NOT NULL,
	"startedAt" timestamp,
	"finishedAt" timestamp,
	"durationMs" integer,
	"appliedCount" integer,
	"logExcerpt" text,
	"logsUrl" text,
	"errorCode" varchar(100),
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "migrationSpecification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"serviceId" uuid NOT NULL,
	"environmentId" uuid NOT NULL,
	"databaseId" uuid NOT NULL,
	"tool" "migrationTool" NOT NULL,
	"phase" "migrationPhase" DEFAULT 'preDeploy' NOT NULL,
	"executionMode" "migrationExecutionMode" NOT NULL,
	"workingDirectory" varchar(500) NOT NULL,
	"migrationPath" varchar(500),
	"command" text NOT NULL,
	"lockStrategy" "migrationLockStrategy" DEFAULT 'platform' NOT NULL,
	"compatibility" "migrationCompatibility" DEFAULT 'backward_compatible' NOT NULL,
	"approvalPolicy" "migrationApprovalPolicy" DEFAULT 'auto' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "migrationSpecification_service_env_db_unique" UNIQUE("serviceId","environmentId","databaseId")
);

CREATE TABLE "projectInitStep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"step" varchar(100) NOT NULL,
	"status" "initStepStatus" DEFAULT 'pending' NOT NULL,
	"message" text,
	"progress" integer DEFAULT 0,
	"errorCode" varchar(100),
	"error" text,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "projectTemplate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"displayName" varchar(255) NOT NULL,
	"description" text,
	"framework" varchar(100),
	"language" varchar(50),
	"dockerfile" text NOT NULL,
	"configYaml" text NOT NULL,
	"files" jsonb,
	"isOfficial" boolean DEFAULT true,
	"sortOrder" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projectTemplate_name_unique" UNIQUE("name")
);

CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"repositoryId" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"framework" varchar(100),
	"productionBranch" varchar(100) DEFAULT 'main',
	"autoDeploy" boolean DEFAULT true,
	"configJson" jsonb,
	"configUpdatedAt" timestamp,
	"status" "projectStatus" DEFAULT 'initializing',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "releaseArtifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"releaseId" uuid NOT NULL,
	"serviceId" uuid NOT NULL,
	"imageUrl" varchar(500) NOT NULL,
	"imageDigest" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "releaseArtifact_release_service_unique" UNIQUE("releaseId","serviceId")
);

CREATE TABLE "release" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"environmentId" uuid NOT NULL,
	"sourceRepository" varchar(255) NOT NULL,
	"sourceRef" varchar(255) NOT NULL,
	"sourceCommitSha" varchar(100),
	"configCommitSha" varchar(100),
	"status" "releaseStatus" DEFAULT 'queued' NOT NULL,
	"triggeredBy" varchar(20) DEFAULT 'api' NOT NULL,
	"triggeredByUserId" uuid,
	"summary" text,
	"recap" jsonb,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "repository" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"providerId" uuid NOT NULL,
	"externalId" varchar(255) NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"owner" varchar(255) NOT NULL,
	"cloneUrl" varchar(500),
	"sshUrl" varchar(500),
	"webUrl" varchar(500),
	"defaultBranch" varchar(100) DEFAULT 'main',
	"isPrivate" boolean DEFAULT false,
	"lastSyncAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repository_provider_external_unique" UNIQUE("providerId","externalId")
);

CREATE TABLE "schemaRepairAtlasRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planId" uuid NOT NULL,
	"projectId" uuid NOT NULL,
	"environmentId" uuid NOT NULL,
	"databaseId" uuid NOT NULL,
	"status" "atlasExecutionStatus" DEFAULT 'idle' NOT NULL,
	"exitCode" integer,
	"generatedFiles" jsonb,
	"artifactFiles" jsonb,
	"diffSummary" jsonb,
	"commitSha" varchar(100),
	"jobName" varchar(255),
	"log" text,
	"errorMessage" text,
	"startedAt" timestamp,
	"finishedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "schemaRepairPlan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"environmentId" uuid NOT NULL,
	"databaseId" uuid NOT NULL,
	"stateStatus" "environmentSchemaStateStatus" NOT NULL,
	"kind" "schemaRepairPlanKind" NOT NULL,
	"status" "schemaRepairPlanStatus" DEFAULT 'draft' NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text NOT NULL,
	"riskLevel" varchar(20) NOT NULL,
	"expectedVersion" varchar(255),
	"actualVersion" varchar(255),
	"nextActionLabel" text,
	"steps" jsonb NOT NULL,
	"generatedFiles" jsonb,
	"branchName" varchar(255),
	"reviewNumber" integer,
	"reviewUrl" text,
	"reviewState" "schemaRepairReviewState" DEFAULT 'unknown',
	"reviewStateLabel" varchar(50),
	"reviewSyncedAt" timestamp,
	"atlasExecutionStatus" "atlasExecutionStatus" DEFAULT 'idle',
	"atlasExecutionLog" text,
	"atlasExecutionStartedAt" timestamp,
	"atlasExecutionFinishedAt" timestamp,
	"errorMessage" text,
	"createdByUserId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "service" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "serviceType" NOT NULL,
	"buildCommand" varchar(500),
	"dockerfile" text,
	"dockerContext" varchar(255),
	"startCommand" varchar(500),
	"port" integer,
	"replicas" integer DEFAULT 1,
	"healthcheckPath" varchar(255),
	"healthcheckInterval" integer DEFAULT 30,
	"cronSchedule" varchar(100),
	"cpuRequest" varchar(50) DEFAULT '100m',
	"cpuLimit" varchar(50) DEFAULT '500m',
	"memoryRequest" varchar(50) DEFAULT '256Mi',
	"memoryLimit" varchar(50) DEFAULT '512Mi',
	"autoscaling" jsonb,
	"isPublic" boolean DEFAULT true,
	"internalDomain" varchar(255),
	"status" varchar(50) DEFAULT 'pending',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionToken" text NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "session_sessionToken_unique" UNIQUE("sessionToken")
);

CREATE TABLE "teamIntegrationBinding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"integrationIdentityId" uuid NOT NULL,
	"createdByUserId" uuid,
	"authMode" "integrationAuthMode" DEFAULT 'personal' NOT NULL,
	"label" varchar(255),
	"isDefault" boolean DEFAULT false NOT NULL,
	"revokedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "teamInvitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"email" varchar(255),
	"role" "teamRole" DEFAULT 'member' NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teamInvitation_token_unique" UNIQUE("token")
);

CREATE TABLE "teamMember" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"role" "teamRole" DEFAULT 'member' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_slug_unique" UNIQUE("slug")
);

CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);

ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aiEntitlement" ADD CONSTRAINT "aiEntitlement_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aiPluginInstallation" ADD CONSTRAINT "aiPluginInstallation_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aiPluginInstallation" ADD CONSTRAINT "aiPluginInstallation_installedByUserId_user_id_fk" FOREIGN KEY ("installedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "aiPluginRun" ADD CONSTRAINT "aiPluginRun_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aiPluginRun" ADD CONSTRAINT "aiPluginRun_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "aiPluginRun" ADD CONSTRAINT "aiPluginRun_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "aiPluginRun" ADD CONSTRAINT "aiPluginRun_releaseId_release_id_fk" FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "aiPluginSnapshot" ADD CONSTRAINT "aiPluginSnapshot_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aiPluginSnapshot" ADD CONSTRAINT "aiPluginSnapshot_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "aiPluginSnapshot" ADD CONSTRAINT "aiPluginSnapshot_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "aiPluginSnapshot" ADD CONSTRAINT "aiPluginSnapshot_releaseId_release_id_fk" FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "auditLog" ADD CONSTRAINT "auditLog_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "auditLog" ADD CONSTRAINT "auditLog_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "databaseMigration" ADD CONSTRAINT "databaseMigration_databaseId_database_id_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "database" ADD CONSTRAINT "database_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "database" ADD CONSTRAINT "database_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "database" ADD CONSTRAINT "database_sourceDatabaseId_database_id_fk" FOREIGN KEY ("sourceDatabaseId") REFERENCES "public"."database"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "database" ADD CONSTRAINT "database_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "deploymentLog" ADD CONSTRAINT "deploymentLog_deploymentId_deployment_id_fk" FOREIGN KEY ("deploymentId") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_releaseId_release_id_fk" FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_deployedById_user_id_fk" FOREIGN KEY ("deployedById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "domain" ADD CONSTRAINT "domain_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "domain" ADD CONSTRAINT "domain_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "domain" ADD CONSTRAINT "domain_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "environmentSchemaState" ADD CONSTRAINT "environmentSchemaState_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "environmentSchemaState" ADD CONSTRAINT "environmentSchemaState_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "environmentSchemaState" ADD CONSTRAINT "environmentSchemaState_databaseId_database_id_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "environmentVariable" ADD CONSTRAINT "environmentVariable_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "environmentVariable" ADD CONSTRAINT "environmentVariable_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "environmentVariable" ADD CONSTRAINT "environmentVariable_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "environment" ADD CONSTRAINT "environment_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "environment" ADD CONSTRAINT "environment_baseEnvironmentId_environment_id_fk" FOREIGN KEY ("baseEnvironmentId") REFERENCES "public"."environment"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "gitProvider" ADD CONSTRAINT "gitProvider_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "integration_capability_snapshot" ADD CONSTRAINT "integration_capability_snapshot_integrationGrantId_integration_grant_id_fk" FOREIGN KEY ("integrationGrantId") REFERENCES "public"."integration_grant"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "integration_grant" ADD CONSTRAINT "integration_grant_integrationIdentityId_integration_identity_id_fk" FOREIGN KEY ("integrationIdentityId") REFERENCES "public"."integration_identity"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "integration_identity" ADD CONSTRAINT "integration_identity_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "migrationRunItem" ADD CONSTRAINT "migrationRunItem_migrationRunId_migrationRun_id_fk" FOREIGN KEY ("migrationRunId") REFERENCES "public"."migrationRun"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_databaseId_database_id_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_specificationId_migrationSpecification_id_fk" FOREIGN KEY ("specificationId") REFERENCES "public"."migrationSpecification"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_releaseId_release_id_fk" FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_deploymentId_deployment_id_fk" FOREIGN KEY ("deploymentId") REFERENCES "public"."deployment"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_triggeredByUserId_user_id_fk" FOREIGN KEY ("triggeredByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "migrationSpecification" ADD CONSTRAINT "migrationSpecification_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "migrationSpecification" ADD CONSTRAINT "migrationSpecification_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "migrationSpecification" ADD CONSTRAINT "migrationSpecification_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "migrationSpecification" ADD CONSTRAINT "migrationSpecification_databaseId_database_id_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "projectInitStep" ADD CONSTRAINT "projectInitStep_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "project" ADD CONSTRAINT "project_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "project" ADD CONSTRAINT "project_repositoryId_repository_id_fk" FOREIGN KEY ("repositoryId") REFERENCES "public"."repository"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "releaseArtifact" ADD CONSTRAINT "releaseArtifact_releaseId_release_id_fk" FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "releaseArtifact" ADD CONSTRAINT "releaseArtifact_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "release" ADD CONSTRAINT "release_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "release" ADD CONSTRAINT "release_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "release" ADD CONSTRAINT "release_triggeredByUserId_user_id_fk" FOREIGN KEY ("triggeredByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "repository" ADD CONSTRAINT "repository_providerId_integration_identity_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."integration_identity"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "schemaRepairAtlasRun" ADD CONSTRAINT "schemaRepairAtlasRun_planId_schemaRepairPlan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."schemaRepairPlan"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "schemaRepairAtlasRun" ADD CONSTRAINT "schemaRepairAtlasRun_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "schemaRepairAtlasRun" ADD CONSTRAINT "schemaRepairAtlasRun_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "schemaRepairAtlasRun" ADD CONSTRAINT "schemaRepairAtlasRun_databaseId_database_id_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "schemaRepairPlan" ADD CONSTRAINT "schemaRepairPlan_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "schemaRepairPlan" ADD CONSTRAINT "schemaRepairPlan_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "schemaRepairPlan" ADD CONSTRAINT "schemaRepairPlan_databaseId_database_id_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "schemaRepairPlan" ADD CONSTRAINT "schemaRepairPlan_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "service" ADD CONSTRAINT "service_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "teamIntegrationBinding" ADD CONSTRAINT "teamIntegrationBinding_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "teamIntegrationBinding" ADD CONSTRAINT "teamIntegrationBinding_integrationIdentityId_integration_identity_id_fk" FOREIGN KEY ("integrationIdentityId") REFERENCES "public"."integration_identity"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "teamIntegrationBinding" ADD CONSTRAINT "teamIntegrationBinding_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "teamInvitation" ADD CONSTRAINT "teamInvitation_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "teamMember" ADD CONSTRAINT "teamMember_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "teamMember" ADD CONSTRAINT "teamMember_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "aiEntitlement_teamId_idx" ON "aiEntitlement" USING btree ("teamId");
CREATE INDEX "aiEntitlement_pluginId_idx" ON "aiEntitlement" USING btree ("pluginId");
CREATE INDEX "aiEntitlement_plan_idx" ON "aiEntitlement" USING btree ("plan");
CREATE INDEX "aiPluginInstallation_teamId_idx" ON "aiPluginInstallation" USING btree ("teamId");
CREATE INDEX "aiPluginInstallation_pluginId_idx" ON "aiPluginInstallation" USING btree ("pluginId");
CREATE INDEX "aiPluginRun_teamId_idx" ON "aiPluginRun" USING btree ("teamId");
CREATE INDEX "aiPluginRun_projectId_idx" ON "aiPluginRun" USING btree ("projectId");
CREATE INDEX "aiPluginRun_releaseId_idx" ON "aiPluginRun" USING btree ("releaseId");
CREATE INDEX "aiPluginRun_pluginId_idx" ON "aiPluginRun" USING btree ("pluginId");
CREATE INDEX "aiPluginRun_createdAt_idx" ON "aiPluginRun" USING btree ("createdAt");
CREATE INDEX "aiPluginSnapshot_teamId_idx" ON "aiPluginSnapshot" USING btree ("teamId");
CREATE INDEX "aiPluginSnapshot_projectId_idx" ON "aiPluginSnapshot" USING btree ("projectId");
CREATE INDEX "aiPluginSnapshot_releaseId_idx" ON "aiPluginSnapshot" USING btree ("releaseId");
CREATE INDEX "aiPluginSnapshot_resource_lookup_idx" ON "aiPluginSnapshot" USING btree ("pluginId","resourceType","resourceId","generatedAt");
CREATE INDEX "auditLog_teamId_idx" ON "auditLog" USING btree ("teamId");
CREATE INDEX "auditLog_createdAt_idx" ON "auditLog" USING btree ("createdAt");
CREATE INDEX "databaseMigration_databaseId_idx" ON "databaseMigration" USING btree ("databaseId");
CREATE INDEX "database_projectId_idx" ON "database" USING btree ("projectId");
CREATE INDEX "database_environmentId_idx" ON "database" USING btree ("environmentId");
CREATE INDEX "database_sourceDatabaseId_idx" ON "database" USING btree ("sourceDatabaseId");
CREATE INDEX "deploymentLog_deploymentId_idx" ON "deploymentLog" USING btree ("deploymentId");
CREATE INDEX "deployment_releaseId_idx" ON "deployment" USING btree ("releaseId");
CREATE INDEX "deployment_projectId_idx" ON "deployment" USING btree ("projectId");
CREATE INDEX "deployment_status_idx" ON "deployment" USING btree ("status");
CREATE INDEX "domain_projectId_idx" ON "domain" USING btree ("projectId");
CREATE INDEX "domain_hostname_idx" ON "domain" USING btree ("hostname");
CREATE INDEX "environmentSchemaState_projectId_idx" ON "environmentSchemaState" USING btree ("projectId");
CREATE INDEX "environmentSchemaState_environmentId_idx" ON "environmentSchemaState" USING btree ("environmentId");
CREATE INDEX "environmentSchemaState_databaseId_idx" ON "environmentSchemaState" USING btree ("databaseId");
CREATE INDEX "environmentVariable_projectId_idx" ON "environmentVariable" USING btree ("projectId");
CREATE INDEX "environment_projectId_idx" ON "environment" USING btree ("projectId");
CREATE INDEX "environment_preview_idx" ON "environment" USING btree ("projectId","isPreview");
CREATE INDEX "environment_preview_pr_idx" ON "environment" USING btree ("projectId","previewPrNumber");
CREATE INDEX "environment_base_env_idx" ON "environment" USING btree ("baseEnvironmentId");
CREATE INDEX "gitProvider_userId_idx" ON "gitProvider" USING btree ("userId");
CREATE INDEX "gitProvider_type_idx" ON "gitProvider" USING btree ("type");
CREATE INDEX "integration_capability_snapshot_grant_id_idx" ON "integration_capability_snapshot" USING btree ("integrationGrantId");
CREATE INDEX "integration_capability_snapshot_capability_idx" ON "integration_capability_snapshot" USING btree ("capability");
CREATE INDEX "integration_grant_identity_id_idx" ON "integration_grant" USING btree ("integrationIdentityId");
CREATE INDEX "integration_grant_revoked_at_idx" ON "integration_grant" USING btree ("revokedAt");
CREATE INDEX "integration_identity_userId_idx" ON "integration_identity" USING btree ("userId");
CREATE INDEX "integration_identity_provider_idx" ON "integration_identity" USING btree ("provider");
CREATE INDEX "migrationRunItem_run_id_idx" ON "migrationRunItem" USING btree ("migrationRunId");
CREATE INDEX "migrationRun_projectId_idx" ON "migrationRun" USING btree ("projectId");
CREATE INDEX "migrationRun_serviceId_idx" ON "migrationRun" USING btree ("serviceId");
CREATE INDEX "migrationRun_environmentId_idx" ON "migrationRun" USING btree ("environmentId");
CREATE INDEX "migrationRun_databaseId_idx" ON "migrationRun" USING btree ("databaseId");
CREATE INDEX "migrationRun_releaseId_idx" ON "migrationRun" USING btree ("releaseId");
CREATE INDEX "migrationRun_deploymentId_idx" ON "migrationRun" USING btree ("deploymentId");
CREATE INDEX "migrationRun_status_idx" ON "migrationRun" USING btree ("status");
CREATE INDEX "migrationSpecification_projectId_idx" ON "migrationSpecification" USING btree ("projectId");
CREATE INDEX "migrationSpecification_serviceId_idx" ON "migrationSpecification" USING btree ("serviceId");
CREATE INDEX "migrationSpecification_environmentId_idx" ON "migrationSpecification" USING btree ("environmentId");
CREATE INDEX "migrationSpecification_databaseId_idx" ON "migrationSpecification" USING btree ("databaseId");
CREATE INDEX "projectInitStep_projectId_idx" ON "projectInitStep" USING btree ("projectId");
CREATE INDEX "project_teamId_idx" ON "project" USING btree ("teamId");
CREATE INDEX "project_slug_idx" ON "project" USING btree ("slug");
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");
CREATE INDEX "releaseArtifact_releaseId_idx" ON "releaseArtifact" USING btree ("releaseId");
CREATE INDEX "releaseArtifact_serviceId_idx" ON "releaseArtifact" USING btree ("serviceId");
CREATE INDEX "release_projectId_idx" ON "release" USING btree ("projectId");
CREATE INDEX "release_environmentId_idx" ON "release" USING btree ("environmentId");
CREATE INDEX "release_status_idx" ON "release" USING btree ("status");
CREATE INDEX "release_sourceRepository_idx" ON "release" USING btree ("sourceRepository");
CREATE INDEX "repository_providerId_idx" ON "repository" USING btree ("providerId");
CREATE INDEX "repository_fullName_idx" ON "repository" USING btree ("fullName");
CREATE INDEX "schemaRepairAtlasRun_planId_idx" ON "schemaRepairAtlasRun" USING btree ("planId");
CREATE INDEX "schemaRepairAtlasRun_projectId_idx" ON "schemaRepairAtlasRun" USING btree ("projectId");
CREATE INDEX "schemaRepairAtlasRun_databaseId_idx" ON "schemaRepairAtlasRun" USING btree ("databaseId");
CREATE INDEX "schemaRepairAtlasRun_createdAt_idx" ON "schemaRepairAtlasRun" USING btree ("createdAt");
CREATE INDEX "schemaRepairPlan_projectId_idx" ON "schemaRepairPlan" USING btree ("projectId");
CREATE INDEX "schemaRepairPlan_environmentId_idx" ON "schemaRepairPlan" USING btree ("environmentId");
CREATE INDEX "schemaRepairPlan_databaseId_idx" ON "schemaRepairPlan" USING btree ("databaseId");
CREATE INDEX "schemaRepairPlan_createdAt_idx" ON "schemaRepairPlan" USING btree ("createdAt");
CREATE INDEX "service_projectId_idx" ON "service" USING btree ("projectId");
CREATE INDEX "teamIntegrationBinding_teamId_idx" ON "teamIntegrationBinding" USING btree ("teamId");
CREATE INDEX "teamIntegrationBinding_identityId_idx" ON "teamIntegrationBinding" USING btree ("integrationIdentityId");
CREATE INDEX "teamIntegrationBinding_default_idx" ON "teamIntegrationBinding" USING btree ("teamId","isDefault");
CREATE INDEX "teamIntegrationBinding_revokedAt_idx" ON "teamIntegrationBinding" USING btree ("revokedAt");
CREATE INDEX "teamMember_teamId_idx" ON "teamMember" USING btree ("teamId");
CREATE INDEX "teamMember_userId_idx" ON "teamMember" USING btree ("userId");
