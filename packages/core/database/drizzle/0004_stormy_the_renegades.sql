DROP INDEX "projects_org_slug_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_slug_unique" ON "projects" USING btree ("organization_id","slug") WHERE deleted_at IS NULL;