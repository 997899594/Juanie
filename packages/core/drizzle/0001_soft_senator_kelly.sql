CREATE TABLE "git_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_type" text NOT NULL,
	"action" text NOT NULL,
	"project_id" uuid,
	"user_id" uuid,
	"organization_id" uuid,
	"provider" text NOT NULL,
	"git_resource_id" text,
	"git_resource_url" text,
	"status" text NOT NULL,
	"error" text,
	"error_stack" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_git_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"git_user_id" text NOT NULL,
	"git_username" text NOT NULL,
	"git_email" text,
	"git_avatar_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_at" timestamp,
	"sync_status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "git_provider" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "git_org_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "git_org_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "git_org_url" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "git_sync_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "git_last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_git_accounts" ADD CONSTRAINT "user_git_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "git_sync_logs_project_id_idx" ON "git_sync_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "git_sync_logs_user_id_idx" ON "git_sync_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "git_sync_logs_status_idx" ON "git_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "git_sync_logs_created_at_idx" ON "git_sync_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_git_accounts_user_provider_unique" ON "user_git_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "user_git_accounts_git_user_id_idx" ON "user_git_accounts" USING btree ("git_user_id");--> statement-breakpoint
CREATE INDEX "user_git_accounts_sync_status_idx" ON "user_git_accounts" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "orgs_git_provider_idx" ON "organizations" USING btree ("git_provider");