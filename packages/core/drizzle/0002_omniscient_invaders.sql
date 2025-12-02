DROP INDEX "git_sync_logs_project_id_idx";--> statement-breakpoint
DROP INDEX "git_sync_logs_user_id_idx";--> statement-breakpoint
DROP INDEX "git_sync_logs_status_idx";--> statement-breakpoint
DROP INDEX "git_sync_logs_created_at_idx";--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD COLUMN "git_resource_type" text;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD COLUMN "error_type" text;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD COLUMN "requires_resolution" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD COLUMN "resolved" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD COLUMN "resolution_notes" text;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;