ALTER TABLE "oauth_accounts" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;