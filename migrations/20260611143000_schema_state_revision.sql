ALTER TABLE "environmentSchemaState" ADD COLUMN "sourceRef" varchar(500);
ALTER TABLE "environmentSchemaState" ADD COLUMN "sourceCommitSha" varchar(100);

CREATE TABLE "environmentSchemaStateRevision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"environmentId" uuid NOT NULL,
	"databaseId" uuid NOT NULL,
	"sourceKey" varchar(700) NOT NULL,
	"sourceRef" varchar(500),
	"sourceCommitSha" varchar(100),
	"status" "environmentSchemaStateStatus" NOT NULL,
	"expectedVersion" varchar(255),
	"actualVersion" varchar(255),
	"expectedChecksum" varchar(64),
	"actualChecksum" varchar(64),
	"hasLedger" boolean DEFAULT false NOT NULL,
	"hasUserTables" boolean DEFAULT false NOT NULL,
	"summary" text,
	"inspectedAt" timestamp NOT NULL,
	"lastErrorCode" varchar(100),
	"lastErrorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "environmentSchemaStateRevision_database_revision_unique" UNIQUE("databaseId","sourceKey")
);

ALTER TABLE "environmentSchemaStateRevision" ADD CONSTRAINT "environmentSchemaStateRevision_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "environmentSchemaStateRevision" ADD CONSTRAINT "environmentSchemaStateRevision_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "environmentSchemaStateRevision" ADD CONSTRAINT "environmentSchemaStateRevision_databaseId_database_id_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "environmentSchemaStateRevision_projectId_idx" ON "environmentSchemaStateRevision" USING btree ("projectId");
CREATE INDEX "environmentSchemaStateRevision_environmentId_idx" ON "environmentSchemaStateRevision" USING btree ("environmentId");
CREATE INDEX "environmentSchemaStateRevision_databaseId_idx" ON "environmentSchemaStateRevision" USING btree ("databaseId");
CREATE INDEX "environmentSchemaStateRevision_sourceKey_idx" ON "environmentSchemaStateRevision" USING btree ("databaseId","sourceKey");
CREATE INDEX "environmentSchemaStateRevision_sourceCommit_idx" ON "environmentSchemaStateRevision" USING btree ("databaseId","sourceCommitSha");
CREATE INDEX "environmentSchemaStateRevision_sourceRef_idx" ON "environmentSchemaStateRevision" USING btree ("databaseId","sourceRef");
