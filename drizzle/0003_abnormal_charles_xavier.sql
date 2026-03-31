ALTER TYPE "public"."deploymentStatus" ADD VALUE 'awaiting_rollout' BEFORE 'running';--> statement-breakpoint
ALTER TYPE "public"."deploymentStatus" ADD VALUE 'verification_failed' BEFORE 'running';--> statement-breakpoint
ALTER TYPE "public"."releaseStatus" ADD VALUE 'awaiting_rollout' BEFORE 'verifying';--> statement-breakpoint
ALTER TYPE "public"."releaseStatus" ADD VALUE 'verification_failed' BEFORE 'migration_post_running';--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "errorMessage" text;