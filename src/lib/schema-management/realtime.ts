import type {
  AtlasExecutionStatus,
  EnvironmentSchemaStateStatus,
  SchemaRepairPlanKind,
  SchemaRepairPlanStatus,
  SchemaRepairReviewState,
} from '@/lib/db/schema';

interface SchemaRepairRealtimeSchemaStateLike {
  status: EnvironmentSchemaStateStatus;
  summary: string | null;
  expectedVersion: string | null;
  actualVersion: string | null;
  lastInspectedAt: string | Date | null;
}

interface SchemaRepairRealtimePlanLike {
  id: string;
  kind: SchemaRepairPlanKind;
  status: SchemaRepairPlanStatus;
  reviewState: SchemaRepairReviewState;
  atlasExecutionStatus: AtlasExecutionStatus;
  atlasExecutionStartedAt: string | Date | null;
  atlasExecutionFinishedAt: string | Date | null;
  errorMessage: string | null;
}

interface SchemaRepairRealtimeAtlasRunLike {
  id: string;
  status: AtlasExecutionStatus;
  startedAt: string | Date | null;
  finishedAt: string | Date | null;
}

export interface SchemaRepairRealtimeStateLike {
  id: string;
  schemaState: SchemaRepairRealtimeSchemaStateLike | null;
  latestRepairPlan: SchemaRepairRealtimePlanLike | null;
  latestAtlasRun: SchemaRepairRealtimeAtlasRunLike | null;
}

export interface SchemaRepairRealtimeRecord extends SchemaRepairRealtimeStateLike {
  projectId: string;
  environmentId: string;
}

export interface SchemaRepairRealtimeUpdatedEvent {
  kind: 'schema_repair_updated';
  projectId: string;
  repair: SchemaRepairRealtimeRecord;
  timestamp: number;
}

export type SchemaRepairRealtimeEvent = SchemaRepairRealtimeUpdatedEvent;

function normalizeTimestamp(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

export function buildSchemaRepairRealtimeStateKey(record: SchemaRepairRealtimeStateLike): string {
  return [
    record.id,
    record.schemaState?.status ?? '',
    record.schemaState?.summary ?? '',
    record.schemaState?.expectedVersion ?? '',
    record.schemaState?.actualVersion ?? '',
    normalizeTimestamp(record.schemaState?.lastInspectedAt),
    record.latestRepairPlan?.id ?? '',
    record.latestRepairPlan?.kind ?? '',
    record.latestRepairPlan?.status ?? '',
    record.latestRepairPlan?.reviewState ?? '',
    record.latestRepairPlan?.atlasExecutionStatus ?? '',
    normalizeTimestamp(record.latestRepairPlan?.atlasExecutionStartedAt),
    normalizeTimestamp(record.latestRepairPlan?.atlasExecutionFinishedAt),
    record.latestRepairPlan?.errorMessage ?? '',
    record.latestAtlasRun?.id ?? '',
    record.latestAtlasRun?.status ?? '',
    normalizeTimestamp(record.latestAtlasRun?.startedAt),
    normalizeTimestamp(record.latestAtlasRun?.finishedAt),
  ].join(':');
}

export function buildSchemaRepairRealtimeStateIndex(
  environments: Array<{
    databases: SchemaRepairRealtimeStateLike[];
  }>
): Record<string, string> {
  return Object.fromEntries(
    environments.flatMap((environment) =>
      environment.databases.map((database) => [
        database.id,
        buildSchemaRepairRealtimeStateKey(database),
      ])
    )
  );
}
