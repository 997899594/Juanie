ALTER TABLE "projects" DROP COLUMN "git_provider";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "git_repo_url";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "git_repo_name";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "git_default_branch";--> statement-breakpoint
ALTER TABLE "repositories" DROP COLUMN "flux_sync_status";--> statement-breakpoint
ALTER TABLE "repositories" DROP COLUMN "flux_last_sync_commit";--> statement-breakpoint
ALTER TABLE "repositories" DROP COLUMN "flux_last_sync_time";--> statement-breakpoint
ALTER TABLE "repositories" DROP COLUMN "flux_error_message";