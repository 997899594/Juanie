ALTER TABLE "deployments" ADD COLUMN "commit_message" text;--> statement-breakpoint
ALTER TABLE "environments" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "environments" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "environments" ADD COLUMN "health_check_url" text;--> statement-breakpoint
ALTER TABLE "security_policies" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;