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
DROP INDEX "projects_status_idx";--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_connections" ADD CONSTRAINT "git_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "idx_project_members_user_id" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_project_user" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_role" ON "project_members" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_projects_organization_id" ON "projects" USING btree ("organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_org_status" ON "projects" USING btree ("organization_id","status") WHERE deleted_at IS NULL;