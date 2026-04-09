CREATE TYPE "public"."integrationAuthMode" AS ENUM('personal', 'service');--> statement-breakpoint
CREATE TABLE "teamIntegrationBinding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"integrationIdentityId" uuid NOT NULL,
	"createdByUserId" uuid,
	"authMode" "integrationAuthMode" DEFAULT 'personal' NOT NULL,
	"label" varchar(255),
	"isDefault" boolean DEFAULT false NOT NULL,
	"revokedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teamIntegrationBinding" ADD CONSTRAINT "teamIntegrationBinding_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamIntegrationBinding" ADD CONSTRAINT "teamIntegrationBinding_integrationIdentityId_integration_identity_id_fk" FOREIGN KEY ("integrationIdentityId") REFERENCES "public"."integration_identity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamIntegrationBinding" ADD CONSTRAINT "teamIntegrationBinding_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teamIntegrationBinding_teamId_idx" ON "teamIntegrationBinding" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "teamIntegrationBinding_identityId_idx" ON "teamIntegrationBinding" USING btree ("integrationIdentityId");--> statement-breakpoint
CREATE INDEX "teamIntegrationBinding_default_idx" ON "teamIntegrationBinding" USING btree ("teamId","isDefault");--> statement-breakpoint
CREATE INDEX "teamIntegrationBinding_revokedAt_idx" ON "teamIntegrationBinding" USING btree ("revokedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "teamIntegrationBinding_default_active_unique" ON "teamIntegrationBinding" USING btree ("teamId") WHERE ("isDefault" = true AND "revokedAt" IS NULL);
