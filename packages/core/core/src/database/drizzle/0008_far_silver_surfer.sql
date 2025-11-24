ALTER TABLE "oauth_accounts" ALTER COLUMN "server_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ALTER COLUMN "server_type" SET DEFAULT 'cloud';--> statement-breakpoint
ALTER TABLE "oauth_accounts" ALTER COLUMN "server_type" SET NOT NULL;