CREATE TABLE "deploymentDiagnostic" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deploymentId" uuid NOT NULL,
  "releaseId" uuid,
  "projectId" uuid NOT NULL,
  "environmentId" uuid NOT NULL,
  "serviceId" uuid,
  "namespace" varchar(255),
  "workloadKind" varchar(40) NOT NULL,
  "workloadName" varchar(255),
  "reason" varchar(80) NOT NULL,
  "summary" text NOT NULL,
  "errorMessage" text,
  "snapshot" jsonb NOT NULL,
  "capturedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "deploymentDiagnostic_deploymentId_deployment_id_fk"
    FOREIGN KEY ("deploymentId") REFERENCES "deployment"("id") ON DELETE cascade,
  CONSTRAINT "deploymentDiagnostic_releaseId_release_id_fk"
    FOREIGN KEY ("releaseId") REFERENCES "release"("id") ON DELETE set null,
  CONSTRAINT "deploymentDiagnostic_projectId_project_id_fk"
    FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE cascade,
  CONSTRAINT "deploymentDiagnostic_environmentId_environment_id_fk"
    FOREIGN KEY ("environmentId") REFERENCES "environment"("id") ON DELETE cascade,
  CONSTRAINT "deploymentDiagnostic_serviceId_service_id_fk"
    FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE set null
);

CREATE INDEX "deploymentDiagnostic_deploymentId_idx"
  ON "deploymentDiagnostic" ("deploymentId");
CREATE INDEX "deploymentDiagnostic_releaseId_idx"
  ON "deploymentDiagnostic" ("releaseId");
CREATE INDEX "deploymentDiagnostic_environment_capturedAt_idx"
  ON "deploymentDiagnostic" ("environmentId", "capturedAt");
CREATE INDEX "deploymentDiagnostic_workload_idx"
  ON "deploymentDiagnostic" ("namespace", "workloadKind", "workloadName");
