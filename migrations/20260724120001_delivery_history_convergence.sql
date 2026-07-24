-- atlas:txmode none

-- Imported delivery records need a truthful terminal state that does not claim a verified release.
ALTER TYPE "public"."deliveryExecutionStatus" ADD VALUE 'historical' AFTER 'production_verified';

-- A historical build with no planned units is a proven no-op and can retain the stronger terminal state.
INSERT INTO "public"."deliveryExecutionEvent" (
  "deliveryExecutionId", "eventKey", "type", "fromStatus", "toStatus", "data", "occurredAt"
)
SELECT
  execution."id",
  'build.no-change.' || build."id"::text,
  'delivery.no_change',
  execution."status",
  'production_verified',
  jsonb_build_object('buildRunId', build."id", 'reason', 'imported_no_affected_units'),
  COALESCE(build."finishedAt", build."updatedAt")
FROM "public"."deliveryExecution" execution
JOIN "public"."sourceDelivery" source ON source."id" = execution."id"
JOIN "public"."buildRun" build ON build."deliveryExecutionId" = execution."id"
WHERE execution."status" IN ('received', 'dispatching')
  AND build."status" = 'succeeded'
  AND build."releaseId" IS NULL
  AND jsonb_typeof(build."plan" -> 'units') = 'array'
  AND jsonb_array_length(build."plan" -> 'units') = 0
ON CONFLICT ("deliveryExecutionId", "eventKey") DO NOTHING;

UPDATE "public"."buildRun" build
SET
  "status" = 'finalized',
  "finishedAt" = COALESCE(build."finishedAt", build."updatedAt")
FROM "public"."deliveryExecution" execution
JOIN "public"."sourceDelivery" source ON source."id" = execution."id"
WHERE build."deliveryExecutionId" = execution."id"
  AND build."status" = 'succeeded'
  AND build."releaseId" IS NULL
  AND jsonb_typeof(build."plan" -> 'units') = 'array'
  AND jsonb_array_length(build."plan" -> 'units') = 0;

UPDATE "public"."deliveryExecution" execution
SET
  "status" = 'production_verified',
  "lastSignalAt" = COALESCE(build."finishedAt", build."updatedAt"),
  "completedAt" = COALESCE(build."finishedAt", build."updatedAt"),
  "updatedAt" = COALESCE(build."finishedAt", build."updatedAt")
FROM "public"."sourceDelivery" source
JOIN "public"."buildRun" build ON build."deliveryExecutionId" = source."id"
WHERE execution."id" = source."id"
  AND execution."status" IN ('received', 'dispatching')
  AND build."status" = 'finalized'
  AND build."releaseId" IS NULL
  AND jsonb_typeof(build."plan" -> 'units') = 'array'
  AND jsonb_array_length(build."plan" -> 'units') = 0;

-- The remaining imported handoffs predate authoritative build/release tracking.
INSERT INTO "public"."deliveryExecutionEvent" (
  "deliveryExecutionId", "eventKey", "type", "fromStatus", "toStatus", "data", "occurredAt"
)
SELECT
  execution."id",
  'execution.history.imported',
  'execution.history.imported',
  execution."status",
  'historical',
  jsonb_build_object('sourceStatus', source."status"),
  COALESCE(source."dispatchedAt", source."updatedAt")
FROM "public"."deliveryExecution" execution
JOIN "public"."sourceDelivery" source ON source."id" = execution."id"
WHERE execution."status" IN ('received', 'dispatching')
ON CONFLICT ("deliveryExecutionId", "eventKey") DO NOTHING;

UPDATE "public"."deliveryExecution" execution
SET
  "status" = 'historical',
  "lastSignalAt" = COALESCE(source."dispatchedAt", source."updatedAt"),
  "completedAt" = COALESCE(source."dispatchedAt", source."updatedAt"),
  "updatedAt" = COALESCE(source."dispatchedAt", source."updatedAt")
FROM "public"."sourceDelivery" source
WHERE execution."id" = source."id"
  AND execution."status" IN ('received', 'dispatching');
