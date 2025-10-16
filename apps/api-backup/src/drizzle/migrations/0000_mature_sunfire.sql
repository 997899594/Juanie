CREATE TYPE "public"."branch_status" AS ENUM('ACTIVE', 'MERGED', 'DELETED', 'PROTECTED');--> statement-breakpoint
CREATE TYPE "public"."cluster_status" AS ENUM('HEALTHY', 'WARNING', 'ERROR', 'MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."deployment_status" AS ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'STOPPED');--> statement-breakpoint
CREATE TYPE "public"."git_event_type" AS ENUM('PUSH', 'PULL_REQUEST', 'MERGE', 'TAG', 'BRANCH_CREATE', 'BRANCH_DELETE', 'COMMIT');--> statement-breakpoint
CREATE TYPE "public"."git_provider" AS ENUM('GITHUB', 'GITLAB', 'GITEA', 'BITBUCKET');--> statement-breakpoint
CREATE TYPE "public"."merge_request_status" AS ENUM('OPEN', 'MERGED', 'CLOSED', 'DRAFT');--> statement-breakpoint
CREATE TYPE "public"."pipeline_status" AS ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('ACTIVE', 'COMPLETED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('LEARNER', 'MENTOR', 'ADMIN');--> statement-breakpoint
CREATE TABLE "git_branches" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"repository_id" text NOT NULL,
	"name" text NOT NULL,
	"sha" text NOT NULL,
	"status" "branch_status" DEFAULT 'ACTIVE' NOT NULL,
	"is_protected" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"last_commit" json,
	"ahead" integer DEFAULT 0 NOT NULL,
	"behind" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "git_branches_repo_name_unique" UNIQUE("repository_id","name")
);
--> statement-breakpoint
CREATE TABLE "git_commits" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"repository_id" text NOT NULL,
	"sha" text NOT NULL,
	"message" text NOT NULL,
	"author" json NOT NULL,
	"committer" json NOT NULL,
	"parent_shas" json DEFAULT '[]'::json NOT NULL,
	"stats" json,
	"files" json DEFAULT '[]'::json NOT NULL,
	"branch_name" text,
	CONSTRAINT "git_commits_repo_sha_unique" UNIQUE("repository_id","sha")
);
--> statement-breakpoint
CREATE TABLE "git_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"repository_id" text NOT NULL,
	"event_type" "git_event_type" NOT NULL,
	"event_id" text,
	"payload" json NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "git_repositories" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	"project_id" text NOT NULL,
	"provider" "git_provider" NOT NULL,
	"repo_url" text NOT NULL,
	"repo_id" text NOT NULL,
	"repo_name" text NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"access_token" text,
	"webhook_url" text,
	"webhook_secret" text,
	"config" json DEFAULT '{}'::json NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "merge_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"repository_id" text NOT NULL,
	"mr_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source_branch" text NOT NULL,
	"target_branch" text NOT NULL,
	"status" "merge_request_status" DEFAULT 'OPEN' NOT NULL,
	"author_id" text,
	"assignee_id" text,
	"reviewers" json DEFAULT '[]'::json NOT NULL,
	"labels" json DEFAULT '[]'::json NOT NULL,
	"has_conflicts" boolean DEFAULT false NOT NULL,
	"is_mergeable" boolean DEFAULT true NOT NULL,
	"merged_at" timestamp,
	"closed_at" timestamp,
	CONSTRAINT "merge_requests_repo_mr_unique" UNIQUE("repository_id","mr_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"avatar" text,
	"tech_stack" json DEFAULT '[]'::json NOT NULL,
	"status" "project_status" DEFAULT 'ACTIVE' NOT NULL,
	"settings" json DEFAULT '{}'::json NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"star_count" integer DEFAULT 0 NOT NULL,
	"fork_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"device_info" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"profile" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"password_hash" text,
	"reset_token" text,
	"reset_token_expires_at" timestamp with time zone,
	"verification_token" text,
	"verification_token_expires_at" timestamp with time zone,
	CONSTRAINT "user_credentials_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"role" "role" DEFAULT 'LEARNER' NOT NULL,
	"preferences" json DEFAULT '{}'::json NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"tags" json DEFAULT '[]'::json NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"email_verified_at" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "git_branches" ADD CONSTRAINT "git_branches_repository_id_git_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."git_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_commits" ADD CONSTRAINT "git_commits_repository_id_git_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."git_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_events" ADD CONSTRAINT "git_events_repository_id_git_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."git_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_repositories" ADD CONSTRAINT "git_repositories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_repository_id_git_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."git_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "git_branches_status_idx" ON "git_branches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "git_commits_branch_idx" ON "git_commits" USING btree ("branch_name");--> statement-breakpoint
CREATE INDEX "git_events_type_idx" ON "git_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "git_events_processed_idx" ON "git_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "git_events_repo_event_idx" ON "git_events" USING btree ("repository_id","event_id");--> statement-breakpoint
CREATE INDEX "git_repositories_provider_repo_idx" ON "git_repositories" USING btree ("provider","repo_id");--> statement-breakpoint
CREATE INDEX "git_repositories_project_idx" ON "git_repositories" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "merge_requests_status_idx" ON "merge_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "merge_requests_author_idx" ON "merge_requests" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_active_idx" ON "sessions" USING btree ("is_active");