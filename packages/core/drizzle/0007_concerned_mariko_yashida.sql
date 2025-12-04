CREATE TYPE "public"."git_provider" AS ENUM('github', 'gitlab');--> statement-breakpoint
CREATE TYPE "public"."git_resource_type" AS ENUM('repository', 'organization', 'user', 'team', 'member');--> statement-breakpoint
CREATE TYPE "public"."git_sync_action" AS ENUM('create', 'update', 'delete', 'sync', 'add', 'remove');--> statement-breakpoint
CREATE TYPE "public"."git_sync_error_type" AS ENUM('authentication', 'authorization', 'network', 'rate_limit', 'conflict', 'permission', 'not_found', 'validation', 'timeout', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."git_sync_status" AS ENUM('pending', 'processing', 'success', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."git_sync_type" AS ENUM('project', 'member', 'organization');--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "sync_type" SET DATA TYPE "public"."git_sync_type" USING "sync_type"::"public"."git_sync_type";--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "action" SET DATA TYPE "public"."git_sync_action" USING "action"::"public"."git_sync_action";--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "provider" SET DATA TYPE "public"."git_provider" USING "provider"::"public"."git_provider";--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "git_resource_type" SET DATA TYPE "public"."git_resource_type" USING "git_resource_type"::"public"."git_resource_type";--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."git_sync_status";--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "status" SET DATA TYPE "public"."git_sync_status" USING "status"::"public"."git_sync_status";--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "error_type" SET DATA TYPE "public"."git_sync_error_type" USING "error_type"::"public"."git_sync_error_type";--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "requires_resolution" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "resolved" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "resolved_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "git_sync_logs" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "git_sync_logs_project_id_idx" ON "git_sync_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "git_sync_logs_user_id_idx" ON "git_sync_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "git_sync_logs_organization_id_idx" ON "git_sync_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "git_sync_logs_status_idx" ON "git_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "git_sync_logs_provider_idx" ON "git_sync_logs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "git_sync_logs_created_at_idx" ON "git_sync_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "git_sync_logs_project_status_idx" ON "git_sync_logs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "git_sync_logs_status_created_idx" ON "git_sync_logs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "git_sync_logs_requires_resolution_idx" ON "git_sync_logs" USING btree ("requires_resolution","resolved");