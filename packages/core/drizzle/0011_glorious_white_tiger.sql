ALTER TABLE "project_git_auth" DROP CONSTRAINT "project_git_auth_oauth_account_id_oauth_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "project_git_auth" ADD CONSTRAINT "project_git_auth_oauth_account_id_git_connections_id_fk" FOREIGN KEY ("oauth_account_id") REFERENCES "public"."git_connections"("id") ON DELETE set null ON UPDATE no action;