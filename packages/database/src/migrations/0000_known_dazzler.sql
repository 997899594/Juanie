CREATE TYPE "public"."environment_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "public"."environment_type" AS ENUM('development', 'staging', 'production', 'testing');--> statement-breakpoint
CREATE TYPE "public"."git_provider" AS ENUM('github', 'gitlab');--> statement-breakpoint
CREATE TYPE "public"."git_resource_type" AS ENUM('repository', 'organization', 'user', 'team', 'member');--> statement-breakpoint
CREATE TYPE "public"."git_sync_action" AS ENUM('create', 'update', 'delete', 'sync', 'add', 'remove');--> statement-breakpoint
CREATE TYPE "public"."git_sync_error_type" AS ENUM('authentication', 'authorization', 'network', 'rate_limit', 'conflict', 'permission', 'not_found', 'validation', 'timeout', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."git_sync_status" AS ENUM('pending', 'processing', 'success', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."git_sync_type" AS ENUM('project', 'member', 'organization');--> statement-breakpoint
CREATE TYPE "public"."health_status" AS ENUM('healthy', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('initializing', 'active', 'inactive', 'archived', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."project_visibility" AS ENUM('public', 'private', 'internal');--> statement-breakpoint
CREATE TYPE "public"."repository_status" AS ENUM('pending', 'syncing', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "ai_assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"model_config" jsonb,
	"system_prompt" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"average_rating" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"template" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"cost" integer NOT NULL,
	"cached" boolean DEFAULT false NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "git_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"avatar_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"purpose" text DEFAULT 'both' NOT NULL,
	"server_url" text NOT NULL,
	"server_type" text DEFAULT 'cloud' NOT NULL,
	"metadata" jsonb,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"device_info" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"display_name" text,
	"avatar_url" text,
	"preferences" jsonb DEFAULT '{"language":"en","themeMode":"system","themeId":"default","notifications":{"email":true,"inApp":true}}'::jsonb,
	"last_login_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "deployment_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"approver_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"comments" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"pipeline_run_id" uuid,
	"version" text NOT NULL,
	"commit_hash" text NOT NULL,
	"commit_message" text,
	"branch" text NOT NULL,
	"strategy" text DEFAULT 'rolling',
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"deployed_by" uuid,
	"gitops_resource_id" uuid,
	"deployment_method" text DEFAULT 'manual',
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "environment_type" NOT NULL,
	"description" text,
	"status" "environment_status" DEFAULT 'active' NOT NULL,
	"health_check_url" text,
	"config" jsonb DEFAULT '{"approvalRequired":false,"minApprovals":1}'::jsonb,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"commit_hash" text NOT NULL,
	"branch" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"duration" integer,
	"logs_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "git_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_type" "git_sync_type" NOT NULL,
	"action" "git_sync_action" NOT NULL,
	"project_id" uuid,
	"user_id" uuid,
	"organization_id" uuid,
	"provider" "git_provider" NOT NULL,
	"git_resource_id" text,
	"git_resource_url" text,
	"git_resource_type" "git_resource_type",
	"status" "git_sync_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"error_type" "git_sync_error_type",
	"error_stack" text,
	"requires_resolution" boolean DEFAULT false NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_notes" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gitops_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"namespace" text NOT NULL,
	"config" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_reason" text,
	"status_message" text,
	"last_applied_revision" text,
	"last_attempted_revision" text,
	"error_message" text,
	"last_status_update_at" timestamp with time zone,
	"last_applied_at" timestamp with time zone,
	"last_attempted_at" timestamp with time zone,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_git_auth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"auth_type" text DEFAULT 'oauth' NOT NULL,
	"oauth_account_id" uuid,
	"project_token" text,
	"token_scopes" jsonb,
	"token_expires_at" timestamp,
	"pat_token" text,
	"pat_provider" text,
	"pat_scopes" jsonb,
	"pat_expires_at" timestamp,
	"github_app_id" text,
	"github_installation_id" text,
	"github_private_key" text,
	"gitlab_group_id" text,
	"gitlab_group_token" text,
	"gitlab_group_scopes" jsonb,
	"service_account_id" uuid,
	"service_account_config" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_validated_at" timestamp,
	"validation_status" text DEFAULT 'unknown',
	"validation_error" text,
	"health_check_failures" text DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "cost_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"date" text NOT NULL,
	"costs" jsonb,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"environment_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"source" text NOT NULL,
	"ai_confidence" integer,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"project_id" uuid,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"rules" jsonb,
	"is_enforced" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text,
	"logo_url" text,
	"type" text DEFAULT 'team' NOT NULL,
	"owner_id" uuid,
	"quotas" jsonb DEFAULT '{"maxProjects":10,"maxUsers":50,"maxStorageGb":100}'::jsonb,
	"billing" jsonb,
	"git_provider" text,
	"git_org_id" text,
	"git_org_name" text,
	"git_org_url" text,
	"git_sync_enabled" boolean DEFAULT false,
	"git_last_sync_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"triggered_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_initialization_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"step" text NOT NULL,
	"parent_step" text,
	"display_name" text NOT NULL,
	"sequence" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration" integer,
	"error" text,
	"error_stack" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'developer' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending',
	"synced_at" timestamp,
	"sync_error" text
);
--> statement-breakpoint
CREATE TABLE "project_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"tech_stack" jsonb,
	"default_config" jsonb,
	"k8s_templates" jsonb,
	"cicd_templates" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"icon" text,
	"is_public" boolean DEFAULT true,
	"is_system" boolean DEFAULT false,
	"organization_id" uuid,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo_url" text,
	"visibility" "project_visibility" DEFAULT 'private' NOT NULL,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"initialization_job_id" varchar(255),
	"initialization_started_at" timestamp with time zone,
	"initialization_completed_at" timestamp with time zone,
	"initialization_error" text,
	"template_id" uuid,
	"template_config" jsonb,
	"health_score" integer,
	"health_status" "health_status",
	"last_health_check" timestamp,
	"config" jsonb DEFAULT '{"defaultBranch":"main","enableCiCd":true,"enableAi":true}'::jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" "git_provider" NOT NULL,
	"full_name" text NOT NULL,
	"clone_url" text NOT NULL,
	"default_branch" text DEFAULT 'main',
	"last_sync_at" timestamp,
	"status" "repository_status" DEFAULT 'pending',
	"gitops_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"violation_severity" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"status" text DEFAULT 'unread' NOT NULL,
	"read_at" timestamp,
	"priority" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_assistants" ADD CONSTRAINT "ai_assistants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_connections" ADD CONSTRAINT "git_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_approvals" ADD CONSTRAINT "deployment_approvals_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_approvals" ADD CONSTRAINT "deployment_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_pipeline_run_id_pipeline_runs_id_fk" FOREIGN KEY ("pipeline_run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_deployed_by_users_id_fk" FOREIGN KEY ("deployed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_gitops_resource_id_gitops_resources_id_fk" FOREIGN KEY ("gitops_resource_id") REFERENCES "public"."gitops_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gitops_resources" ADD CONSTRAINT "gitops_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gitops_resources" ADD CONSTRAINT "gitops_resources_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gitops_resources" ADD CONSTRAINT "gitops_resources_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_git_auth" ADD CONSTRAINT "project_git_auth_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_git_auth" ADD CONSTRAINT "project_git_auth_oauth_account_id_git_connections_id_fk" FOREIGN KEY ("oauth_account_id") REFERENCES "public"."git_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_git_auth" ADD CONSTRAINT "project_git_auth_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_tracking" ADD CONSTRAINT "cost_tracking_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_tracking" ADD CONSTRAINT "cost_tracking_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_policies" ADD CONSTRAINT "security_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_policies" ADD CONSTRAINT "security_policies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_projects" ADD CONSTRAINT "team_projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_projects" ADD CONSTRAINT "team_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_initialization_steps" ADD CONSTRAINT "project_initialization_steps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_id_project_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."project_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_org_idx" ON "ai_assistants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_type_idx" ON "ai_assistants" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_idx" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_project_idx" ON "ai_conversations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_created_idx" ON "ai_conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "prompt_templates_org_idx" ON "prompt_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "prompt_templates_category_idx" ON "prompt_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "prompt_templates_usage_idx" ON "prompt_templates" USING btree ("usage_count");--> statement-breakpoint
CREATE INDEX "ai_usage_user_idx" ON "ai_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_project_idx" ON "ai_usage" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ai_usage_timestamp_idx" ON "ai_usage" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "ai_usage_provider_model_idx" ON "ai_usage" USING btree ("provider","model");--> statement-breakpoint
CREATE UNIQUE INDEX "git_connections_user_provider_server_unique" ON "git_connections" USING btree ("user_id","provider","server_url");--> statement-breakpoint
CREATE INDEX "git_connections_user_idx" ON "git_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "git_connections_provider_idx" ON "git_connections" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "git_connections_status_idx" ON "git_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "git_connections_provider_account_idx" ON "git_connections" USING btree ("provider_account_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessions_session_id_idx" ON "sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_deleted_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "approvals_deployment_idx" ON "deployment_approvals" USING btree ("deployment_id");--> statement-breakpoint
CREATE INDEX "approvals_status_idx" ON "deployment_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deployments_project_idx" ON "deployments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "deployments_env_idx" ON "deployments" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "deployments_status_idx" ON "deployments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deployments_deleted_idx" ON "deployments" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "envs_project_name_unique" ON "environments" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "envs_type_idx" ON "environments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "envs_deleted_idx" ON "environments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "pipeline_runs_pipeline_idx" ON "pipeline_runs" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipeline_runs_status_idx" ON "pipeline_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pipeline_runs_created_idx" ON "pipeline_runs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pipelines_project_name_unique" ON "pipelines" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "git_sync_logs_project_id_idx" ON "git_sync_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "git_sync_logs_user_id_idx" ON "git_sync_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "git_sync_logs_organization_id_idx" ON "git_sync_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "git_sync_logs_status_idx" ON "git_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "git_sync_logs_provider_idx" ON "git_sync_logs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "git_sync_logs_created_at_idx" ON "git_sync_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "git_sync_logs_project_status_idx" ON "git_sync_logs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "git_sync_logs_status_created_idx" ON "git_sync_logs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "git_sync_logs_requires_resolution_idx" ON "git_sync_logs" USING btree ("requires_resolution","resolved");--> statement-breakpoint
CREATE UNIQUE INDEX "gitops_resources_project_env_name_unique" ON "gitops_resources" USING btree ("project_id","environment_id","name");--> statement-breakpoint
CREATE INDEX "gitops_resources_project_idx" ON "gitops_resources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "gitops_resources_env_idx" ON "gitops_resources" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "gitops_resources_repo_idx" ON "gitops_resources" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "gitops_resources_status_idx" ON "gitops_resources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gitops_resources_deleted_idx" ON "gitops_resources" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_org_project_date_unique" ON "cost_tracking" USING btree ("organization_id","project_id","date");--> statement-breakpoint
CREATE INDEX "cost_date_idx" ON "cost_tracking" USING btree ("date");--> statement-breakpoint
CREATE INDEX "incidents_project_idx" ON "incidents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "incidents_severity_idx" ON "incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "policies_org_idx" ON "security_policies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "policies_project_idx" ON "security_policies" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_unique" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "org_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orgs_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "orgs_deleted_idx" ON "organizations" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "orgs_git_provider_idx" ON "organizations" USING btree ("git_provider");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_unique" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_projects_unique" ON "team_projects" USING btree ("team_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_org_slug_unique" ON "teams" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "teams_deleted_idx" ON "teams" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "project_events_project_idx" ON "project_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_events_type_idx" ON "project_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "project_events_created_idx" ON "project_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "project_events_triggered_by_idx" ON "project_events" USING btree ("triggered_by");--> statement-breakpoint
CREATE INDEX "project_initialization_steps_project_id_idx" ON "project_initialization_steps" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_initialization_steps_project_step_idx" ON "project_initialization_steps" USING btree ("project_id","step");--> statement-breakpoint
CREATE INDEX "project_initialization_steps_status_idx" ON "project_initialization_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_initialization_steps_sequence_idx" ON "project_initialization_steps" USING btree ("project_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_unique" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_user_id" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_project_user" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_role" ON "project_members" USING btree ("role");--> statement-breakpoint
CREATE INDEX "project_members_status_idx" ON "project_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_templates_slug_idx" ON "project_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "project_templates_category_idx" ON "project_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "project_templates_is_public_idx" ON "project_templates" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "project_templates_is_system_idx" ON "project_templates" USING btree ("is_system");--> statement-breakpoint
CREATE INDEX "project_templates_org_idx" ON "project_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_slug_unique" ON "projects" USING btree ("organization_id","slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_organization_id" ON "projects" USING btree ("organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_org_status" ON "projects" USING btree ("organization_id","status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "projects_deleted_idx" ON "projects" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "projects_template_idx" ON "projects" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "projects_health_status_idx" ON "projects" USING btree ("health_status");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_project_fullname_unique" ON "repositories" USING btree ("project_id","full_name");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifs_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifs_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifs_created_idx" ON "notifications" USING btree ("created_at");