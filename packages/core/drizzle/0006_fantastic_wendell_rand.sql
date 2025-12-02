ALTER TABLE "projects" ADD COLUMN "git_provider" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "git_repo_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "git_repo_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "git_default_branch" text DEFAULT 'main';