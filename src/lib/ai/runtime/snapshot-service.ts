import { createHash } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiPluginSnapshots } from '@/lib/db/schema';

export interface AIPluginSnapshotRecord<TOutput = unknown> {
  pluginId: string;
  teamId: string;
  projectId?: string;
  environmentId?: string;
  releaseId?: string;
  resourceType: string;
  resourceId: string;
  schemaVersion: string;
  inputHash: string;
  provider: string | null;
  model: string | null;
  degradedReason: string | null;
  output: TOutput;
  generatedAt: string;
}

export interface StoredAIPluginSnapshot<TOutput = unknown> extends AIPluginSnapshotRecord<TOutput> {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
}

function stableSerialize(value: unknown): string {
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );

    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function toStoredSnapshot<TOutput>(
  row: typeof aiPluginSnapshots.$inferSelect
): StoredAIPluginSnapshot<TOutput> {
  return {
    id: row.id,
    pluginId: row.pluginId,
    teamId: row.teamId,
    projectId: row.projectId ?? undefined,
    environmentId: row.environmentId ?? undefined,
    releaseId: row.releaseId ?? undefined,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    schemaVersion: row.schemaVersion,
    inputHash: row.inputHash,
    provider: row.provider,
    model: row.model,
    degradedReason: row.degradedReason,
    output: row.output as TOutput,
    generatedAt: row.generatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastAccessedAt: row.lastAccessedAt ? row.lastAccessedAt.toISOString() : null,
  };
}

export function computeAIInputHash(input: unknown): string {
  return createHash('sha256').update(stableSerialize(input)).digest('hex');
}

export async function getFreshAIPluginSnapshot<TOutput>(input: {
  pluginId: string;
  teamId: string;
  resourceType: string;
  resourceId: string;
  schemaVersion: string;
  inputHash: string;
  maxAgeSeconds: number;
}): Promise<StoredAIPluginSnapshot<TOutput> | null> {
  const row = await db.query.aiPluginSnapshots.findFirst({
    where: and(
      eq(aiPluginSnapshots.pluginId, input.pluginId),
      eq(aiPluginSnapshots.teamId, input.teamId),
      eq(aiPluginSnapshots.resourceType, input.resourceType),
      eq(aiPluginSnapshots.resourceId, input.resourceId),
      eq(aiPluginSnapshots.schemaVersion, input.schemaVersion),
      eq(aiPluginSnapshots.inputHash, input.inputHash)
    ),
    orderBy: [desc(aiPluginSnapshots.generatedAt)],
  });

  if (!row) {
    return null;
  }

  const maxAgeMs = input.maxAgeSeconds * 1000;
  if (Date.now() - row.generatedAt.getTime() > maxAgeMs) {
    return null;
  }

  const now = new Date();
  await db
    .update(aiPluginSnapshots)
    .set({
      lastAccessedAt: now,
      updatedAt: now,
    })
    .where(eq(aiPluginSnapshots.id, row.id));

  return toStoredSnapshot<TOutput>({
    ...row,
    lastAccessedAt: now,
    updatedAt: now,
  });
}

export async function getLatestAIPluginSnapshot<TOutput>(input: {
  pluginId: string;
  teamId: string;
  resourceType: string;
  resourceId: string;
}): Promise<StoredAIPluginSnapshot<TOutput> | null> {
  const row = await db.query.aiPluginSnapshots.findFirst({
    where: and(
      eq(aiPluginSnapshots.pluginId, input.pluginId),
      eq(aiPluginSnapshots.teamId, input.teamId),
      eq(aiPluginSnapshots.resourceType, input.resourceType),
      eq(aiPluginSnapshots.resourceId, input.resourceId)
    ),
    orderBy: [desc(aiPluginSnapshots.generatedAt)],
  });

  if (!row) {
    return null;
  }

  return toStoredSnapshot<TOutput>(row);
}

export async function listLatestAIPluginSnapshotsByResourceIds<TOutput>(input: {
  pluginId: string;
  teamId: string;
  resourceType: string;
  resourceIds: string[];
}): Promise<Map<string, StoredAIPluginSnapshot<TOutput>>> {
  if (input.resourceIds.length === 0) {
    return new Map();
  }

  const rows = await db.query.aiPluginSnapshots.findMany({
    where: and(
      eq(aiPluginSnapshots.pluginId, input.pluginId),
      eq(aiPluginSnapshots.teamId, input.teamId),
      eq(aiPluginSnapshots.resourceType, input.resourceType),
      inArray(aiPluginSnapshots.resourceId, input.resourceIds)
    ),
    orderBy: [desc(aiPluginSnapshots.generatedAt)],
  });

  const snapshots = new Map<string, StoredAIPluginSnapshot<TOutput>>();
  for (const row of rows) {
    if (snapshots.has(row.resourceId)) {
      continue;
    }

    snapshots.set(row.resourceId, toStoredSnapshot<TOutput>(row));
  }

  return snapshots;
}

export async function saveAIPluginSnapshot<TOutput>(
  input: AIPluginSnapshotRecord<TOutput>
): Promise<StoredAIPluginSnapshot<TOutput>> {
  const now = new Date();
  const generatedAt = new Date(input.generatedAt);
  const existing = await db.query.aiPluginSnapshots.findFirst({
    where: and(
      eq(aiPluginSnapshots.pluginId, input.pluginId),
      eq(aiPluginSnapshots.resourceType, input.resourceType),
      eq(aiPluginSnapshots.resourceId, input.resourceId),
      eq(aiPluginSnapshots.schemaVersion, input.schemaVersion),
      eq(aiPluginSnapshots.inputHash, input.inputHash)
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(aiPluginSnapshots)
      .set({
        teamId: input.teamId,
        projectId: input.projectId ?? null,
        environmentId: input.environmentId ?? null,
        releaseId: input.releaseId ?? null,
        provider: input.provider,
        model: input.model,
        degradedReason: input.degradedReason,
        output: input.output as Record<string, unknown>,
        generatedAt,
        lastAccessedAt: now,
        updatedAt: now,
      })
      .where(eq(aiPluginSnapshots.id, existing.id))
      .returning();

    return toStoredSnapshot<TOutput>(updated ?? existing);
  }

  const [inserted] = await db
    .insert(aiPluginSnapshots)
    .values({
      pluginId: input.pluginId,
      teamId: input.teamId,
      projectId: input.projectId ?? null,
      environmentId: input.environmentId ?? null,
      releaseId: input.releaseId ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      schemaVersion: input.schemaVersion,
      inputHash: input.inputHash,
      provider: input.provider,
      model: input.model,
      degradedReason: input.degradedReason,
      output: input.output as Record<string, unknown>,
      generatedAt,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toStoredSnapshot<TOutput>(inserted);
}
