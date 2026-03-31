CREATE TYPE "public"."aiPlan" AS ENUM('free', 'pro', 'scale', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."aiPluginRunStatus" AS ENUM('succeeded', 'failed');--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "aiEntitlement" ADD CONSTRAINT "aiEntitlement_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiPluginInstallation" ADD CONSTRAINT "aiPluginInstallation_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiPluginInstallation" ADD CONSTRAINT "aiPluginInstallation_installedByUserId_user_id_fk" FOREIGN KEY ("installedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiPluginRun" ADD CONSTRAINT "aiPluginRun_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiPluginRun" ADD CONSTRAINT "aiPluginRun_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiPluginRun" ADD CONSTRAINT "aiPluginRun_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiPluginRun" ADD CONSTRAINT "aiPluginRun_releaseId_release_id_fk" FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiPluginSnapshot" ADD CONSTRAINT "aiPluginSnapshot_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiPluginSnapshot" ADD CONSTRAINT "aiPluginSnapshot_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiPluginSnapshot" ADD CONSTRAINT "aiPluginSnapshot_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiPluginSnapshot" ADD CONSTRAINT "aiPluginSnapshot_releaseId_release_id_fk" FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aiEntitlement_teamId_idx" ON "aiEntitlement" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "aiEntitlement_pluginId_idx" ON "aiEntitlement" USING btree ("pluginId");--> statement-breakpoint
CREATE INDEX "aiEntitlement_plan_idx" ON "aiEntitlement" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "aiPluginInstallation_teamId_idx" ON "aiPluginInstallation" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "aiPluginInstallation_pluginId_idx" ON "aiPluginInstallation" USING btree ("pluginId");--> statement-breakpoint
CREATE INDEX "aiPluginRun_teamId_idx" ON "aiPluginRun" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "aiPluginRun_projectId_idx" ON "aiPluginRun" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "aiPluginRun_releaseId_idx" ON "aiPluginRun" USING btree ("releaseId");--> statement-breakpoint
CREATE INDEX "aiPluginRun_pluginId_idx" ON "aiPluginRun" USING btree ("pluginId");--> statement-breakpoint
CREATE INDEX "aiPluginRun_createdAt_idx" ON "aiPluginRun" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "aiPluginSnapshot_teamId_idx" ON "aiPluginSnapshot" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "aiPluginSnapshot_projectId_idx" ON "aiPluginSnapshot" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "aiPluginSnapshot_releaseId_idx" ON "aiPluginSnapshot" USING btree ("releaseId");--> statement-breakpoint
CREATE INDEX "aiPluginSnapshot_resource_lookup_idx" ON "aiPluginSnapshot" USING btree ("pluginId","resourceType","resourceId","generatedAt");