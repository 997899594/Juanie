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
	"last_applied_revision" text,
	"last_attempted_revision" text,
	"error_message" text,
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
ALTER TABLE "users" ALTER COLUMN "preferences" SET DEFAULT '{"language":"en","themeMode":"system","themeId":"default","notifications":{"email":true,"inApp":true}}'::jsonb;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "gitops_resource_id" uuid;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "deployment_method" text DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "git_commit_sha" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "initialization_status" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "template_config" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "health_score" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "health_status" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_health_check" timestamp;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "gitops_config" jsonb;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "flux_sync_status" text;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "flux_last_sync_commit" text;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "flux_last_sync_time" timestamp;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "flux_error_message" text;--> statement-breakpoint
ALTER TABLE "gitops_resources" ADD CONSTRAINT "gitops_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gitops_resources" ADD CONSTRAINT "gitops_resources_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gitops_resources" ADD CONSTRAINT "gitops_resources_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gitops_resources_project_env_name_unique" ON "gitops_resources" USING btree ("project_id","environment_id","name");--> statement-breakpoint
CREATE INDEX "gitops_resources_project_idx" ON "gitops_resources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "gitops_resources_env_idx" ON "gitops_resources" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "gitops_resources_repo_idx" ON "gitops_resources" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "gitops_resources_status_idx" ON "gitops_resources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gitops_resources_deleted_idx" ON "gitops_resources" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "project_events_project_idx" ON "project_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_events_type_idx" ON "project_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "project_events_created_idx" ON "project_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "project_events_triggered_by_idx" ON "project_events" USING btree ("triggered_by");--> statement-breakpoint
CREATE INDEX "project_templates_slug_idx" ON "project_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "project_templates_category_idx" ON "project_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "project_templates_is_public_idx" ON "project_templates" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "project_templates_is_system_idx" ON "project_templates" USING btree ("is_system");--> statement-breakpoint
CREATE INDEX "project_templates_org_idx" ON "project_templates" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_gitops_resource_id_gitops_resources_id_fk" FOREIGN KEY ("gitops_resource_id") REFERENCES "public"."gitops_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_template_idx" ON "projects" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "projects_health_status_idx" ON "projects" USING btree ("health_status");