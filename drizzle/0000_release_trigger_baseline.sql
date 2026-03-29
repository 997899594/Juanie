CREATE TYPE "public"."databasePlan" AS ENUM('starter', 'standard', 'premium');--> statement-breakpoint
CREATE TYPE "public"."databaseRole" AS ENUM('primary', 'readonly', 'cache', 'queue', 'analytics');--> statement-breakpoint
CREATE TYPE "public"."databaseScope" AS ENUM('project', 'service');--> statement-breakpoint
CREATE TYPE "public"."databaseType" AS ENUM('postgresql', 'mysql', 'redis', 'mongodb');--> statement-breakpoint
CREATE TYPE "public"."deploymentStatus" AS ENUM('queued', 'migration_pending', 'migration_running', 'migration_failed', 'building', 'deploying', 'running', 'failed', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."environmentDatabaseStrategy" AS ENUM('direct', 'inherit', 'isolated_clone');--> statement-breakpoint
CREATE TYPE "public"."environmentDeploymentStrategy" AS ENUM('rolling', 'controlled', 'canary', 'blue_green');--> statement-breakpoint
CREATE TYPE "public"."gitProviderType" AS ENUM('github', 'gitlab', 'gitlab-self-hosted');--> statement-breakpoint
CREATE TYPE "public"."initStepStatus" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."integrationCapability" AS ENUM('read_repo', 'write_repo', 'write_workflow');--> statement-breakpoint
CREATE TYPE "public"."migrationApprovalPolicy" AS ENUM('auto', 'manual_in_production');--> statement-breakpoint
CREATE TYPE "public"."migrationCompatibility" AS ENUM('backward_compatible', 'breaking');--> statement-breakpoint
CREATE TYPE "public"."migrationLockStrategy" AS ENUM('platform', 'db_advisory');--> statement-breakpoint
CREATE TYPE "public"."migrationPhase" AS ENUM('preDeploy', 'postDeploy', 'manual');--> statement-breakpoint
CREATE TYPE "public"."migrationRunStatus" AS ENUM('queued', 'awaiting_approval', 'planning', 'running', 'success', 'failed', 'canceled', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."migrationRunnerType" AS ENUM('k8s_job', 'ci_job', 'worker');--> statement-breakpoint
CREATE TYPE "public"."migrationTool" AS ENUM('drizzle', 'prisma', 'knex', 'typeorm', 'sql', 'custom');--> statement-breakpoint
CREATE TYPE "public"."projectStatus" AS ENUM('initializing', 'active', 'failed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."releaseStatus" AS ENUM('queued', 'planning', 'migration_pre_running', 'migration_pre_failed', 'deploying', 'verifying', 'migration_post_running', 'degraded', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."serviceType" AS ENUM('web', 'worker', 'cron');--> statement-breakpoint
CREATE TYPE "public"."teamRole" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "deploymentLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deploymentId" uuid NOT NULL,
	"level" varchar(10) DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"deployedById" uuid,
	"deployedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "integration_capability_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integrationGrantId" uuid NOT NULL,
	"capability" "integrationCapability" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_capability_snapshot_grant_capability_unique" UNIQUE("integrationGrantId","capability")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "integration_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"provider" "gitProviderType" NOT NULL,
	"externalUserId" varchar(255),
	"username" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "migrationSpecification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"serviceId" uuid NOT NULL,
	"environmentId" uuid NOT NULL,
	"databaseId" uuid NOT NULL,
	"tool" "migrationTool" NOT NULL,
	"phase" "migrationPhase" DEFAULT 'preDeploy' NOT NULL,
	"autoRun" boolean DEFAULT true NOT NULL,
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "releaseArtifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"releaseId" uuid NOT NULL,
	"serviceId" uuid NOT NULL,
	"imageUrl" varchar(500) NOT NULL,
	"imageDigest" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "releaseArtifact_release_service_unique" UNIQUE("releaseId","serviceId")
);
--> statement-breakpoint
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
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionToken" text NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "session_sessionToken_unique" UNIQUE("sessionToken")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "teamMember" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"role" "teamRole" DEFAULT 'member' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditLog" ADD CONSTRAINT "auditLog_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditLog" ADD CONSTRAINT "auditLog_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databaseMigration" ADD CONSTRAINT "databaseMigration_databaseId_database_id_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_sourceDatabaseId_database_id_fk" FOREIGN KEY ("sourceDatabaseId") REFERENCES "public"."database"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deploymentLog" ADD CONSTRAINT "deploymentLog_deploymentId_deployment_id_fk" FOREIGN KEY ("deploymentId") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_releaseId_release_id_fk" FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_deployedById_user_id_fk" FOREIGN KEY ("deployedById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain" ADD CONSTRAINT "domain_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain" ADD CONSTRAINT "domain_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain" ADD CONSTRAINT "domain_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environmentVariable" ADD CONSTRAINT "environmentVariable_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environmentVariable" ADD CONSTRAINT "environmentVariable_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environmentVariable" ADD CONSTRAINT "environmentVariable_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment" ADD CONSTRAINT "environment_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment" ADD CONSTRAINT "environment_baseEnvironmentId_environment_id_fk" FOREIGN KEY ("baseEnvironmentId") REFERENCES "public"."environment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gitProvider" ADD CONSTRAINT "gitProvider_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_capability_snapshot" ADD CONSTRAINT "integration_capability_snapshot_integrationGrantId_integration_grant_id_fk" FOREIGN KEY ("integrationGrantId") REFERENCES "public"."integration_grant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_grant" ADD CONSTRAINT "integration_grant_integrationIdentityId_integration_identity_id_fk" FOREIGN KEY ("integrationIdentityId") REFERENCES "public"."integration_identity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_identity" ADD CONSTRAINT "integration_identity_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationRunItem" ADD CONSTRAINT "migrationRunItem_migrationRunId_migrationRun_id_fk" FOREIGN KEY ("migrationRunId") REFERENCES "public"."migrationRun"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_databaseId_database_id_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_specificationId_migrationSpecification_id_fk" FOREIGN KEY ("specificationId") REFERENCES "public"."migrationSpecification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_releaseId_release_id_fk" FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_deploymentId_deployment_id_fk" FOREIGN KEY ("deploymentId") REFERENCES "public"."deployment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationRun" ADD CONSTRAINT "migrationRun_triggeredByUserId_user_id_fk" FOREIGN KEY ("triggeredByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationSpecification" ADD CONSTRAINT "migrationSpecification_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationSpecification" ADD CONSTRAINT "migrationSpecification_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationSpecification" ADD CONSTRAINT "migrationSpecification_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrationSpecification" ADD CONSTRAINT "migrationSpecification_databaseId_database_id_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projectInitStep" ADD CONSTRAINT "projectInitStep_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_repositoryId_repository_id_fk" FOREIGN KEY ("repositoryId") REFERENCES "public"."repository"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releaseArtifact" ADD CONSTRAINT "releaseArtifact_releaseId_release_id_fk" FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releaseArtifact" ADD CONSTRAINT "releaseArtifact_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_triggeredByUserId_user_id_fk" FOREIGN KEY ("triggeredByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository" ADD CONSTRAINT "repository_providerId_integration_identity_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."integration_identity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service" ADD CONSTRAINT "service_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamInvitation" ADD CONSTRAINT "teamInvitation_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamMember" ADD CONSTRAINT "teamMember_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamMember" ADD CONSTRAINT "teamMember_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditLog_teamId_idx" ON "auditLog" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "auditLog_createdAt_idx" ON "auditLog" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "databaseMigration_databaseId_idx" ON "databaseMigration" USING btree ("databaseId");--> statement-breakpoint
CREATE INDEX "database_projectId_idx" ON "database" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "database_environmentId_idx" ON "database" USING btree ("environmentId");--> statement-breakpoint
CREATE INDEX "database_sourceDatabaseId_idx" ON "database" USING btree ("sourceDatabaseId");--> statement-breakpoint
CREATE INDEX "deploymentLog_deploymentId_idx" ON "deploymentLog" USING btree ("deploymentId");--> statement-breakpoint
CREATE INDEX "deployment_releaseId_idx" ON "deployment" USING btree ("releaseId");--> statement-breakpoint
CREATE INDEX "deployment_projectId_idx" ON "deployment" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "deployment_status_idx" ON "deployment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "domain_projectId_idx" ON "domain" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "domain_hostname_idx" ON "domain" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "environmentVariable_projectId_idx" ON "environmentVariable" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "environment_projectId_idx" ON "environment" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "environment_preview_idx" ON "environment" USING btree ("projectId","isPreview");--> statement-breakpoint
CREATE INDEX "environment_preview_pr_idx" ON "environment" USING btree ("projectId","previewPrNumber");--> statement-breakpoint
CREATE INDEX "environment_base_env_idx" ON "environment" USING btree ("baseEnvironmentId");--> statement-breakpoint
CREATE INDEX "gitProvider_userId_idx" ON "gitProvider" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "gitProvider_type_idx" ON "gitProvider" USING btree ("type");--> statement-breakpoint
CREATE INDEX "integration_capability_snapshot_grant_id_idx" ON "integration_capability_snapshot" USING btree ("integrationGrantId");--> statement-breakpoint
CREATE INDEX "integration_capability_snapshot_capability_idx" ON "integration_capability_snapshot" USING btree ("capability");--> statement-breakpoint
CREATE INDEX "integration_grant_identity_id_idx" ON "integration_grant" USING btree ("integrationIdentityId");--> statement-breakpoint
CREATE INDEX "integration_grant_revoked_at_idx" ON "integration_grant" USING btree ("revokedAt");--> statement-breakpoint
CREATE INDEX "integration_identity_userId_idx" ON "integration_identity" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "integration_identity_provider_idx" ON "integration_identity" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "migrationRunItem_run_id_idx" ON "migrationRunItem" USING btree ("migrationRunId");--> statement-breakpoint
CREATE INDEX "migrationRun_projectId_idx" ON "migrationRun" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "migrationRun_serviceId_idx" ON "migrationRun" USING btree ("serviceId");--> statement-breakpoint
CREATE INDEX "migrationRun_environmentId_idx" ON "migrationRun" USING btree ("environmentId");--> statement-breakpoint
CREATE INDEX "migrationRun_databaseId_idx" ON "migrationRun" USING btree ("databaseId");--> statement-breakpoint
CREATE INDEX "migrationRun_releaseId_idx" ON "migrationRun" USING btree ("releaseId");--> statement-breakpoint
CREATE INDEX "migrationRun_deploymentId_idx" ON "migrationRun" USING btree ("deploymentId");--> statement-breakpoint
CREATE INDEX "migrationRun_status_idx" ON "migrationRun" USING btree ("status");--> statement-breakpoint
CREATE INDEX "migrationSpecification_projectId_idx" ON "migrationSpecification" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "migrationSpecification_serviceId_idx" ON "migrationSpecification" USING btree ("serviceId");--> statement-breakpoint
CREATE INDEX "migrationSpecification_environmentId_idx" ON "migrationSpecification" USING btree ("environmentId");--> statement-breakpoint
CREATE INDEX "migrationSpecification_databaseId_idx" ON "migrationSpecification" USING btree ("databaseId");--> statement-breakpoint
CREATE INDEX "projectInitStep_projectId_idx" ON "projectInitStep" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "project_teamId_idx" ON "project" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "project_slug_idx" ON "project" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");--> statement-breakpoint
CREATE INDEX "releaseArtifact_releaseId_idx" ON "releaseArtifact" USING btree ("releaseId");--> statement-breakpoint
CREATE INDEX "releaseArtifact_serviceId_idx" ON "releaseArtifact" USING btree ("serviceId");--> statement-breakpoint
CREATE INDEX "release_projectId_idx" ON "release" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "release_environmentId_idx" ON "release" USING btree ("environmentId");--> statement-breakpoint
CREATE INDEX "release_status_idx" ON "release" USING btree ("status");--> statement-breakpoint
CREATE INDEX "release_sourceRepository_idx" ON "release" USING btree ("sourceRepository");--> statement-breakpoint
CREATE INDEX "repository_providerId_idx" ON "repository" USING btree ("providerId");--> statement-breakpoint
CREATE INDEX "repository_fullName_idx" ON "repository" USING btree ("fullName");--> statement-breakpoint
CREATE INDEX "service_projectId_idx" ON "service" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "teamMember_teamId_idx" ON "teamMember" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "teamMember_userId_idx" ON "teamMember" USING btree ("userId");