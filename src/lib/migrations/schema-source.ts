import type { DatabaseType, MigrationTool } from '@/lib/db/schema';
import type { MigrationSpecificationRecord } from './types';

export const schemaSources = [
  'atlas',
  'drizzle',
  'prisma',
  'knex',
  'typeorm',
  'sql',
  'custom',
] as const;

export type SchemaSource = (typeof schemaSources)[number];

export const drizzleSchemaConfigCandidates = [
  'drizzle.config.ts',
  'drizzle.config.mjs',
  'drizzle.config.js',
  'drizzle.config.cjs',
] as const;

export function usesPlatformInternalCommand(command: string | null | undefined): boolean {
  return typeof command === 'string' && command.startsWith('juanie:platform:');
}

export function buildPlatformInternalCommand(source: SchemaSource, tool: MigrationTool): string {
  return `juanie:platform:${source}:${tool}`;
}

export function resolveExecutionToolForSchemaSource(
  source: SchemaSource,
  databaseType: DatabaseType
): MigrationTool {
  if (source === 'atlas') {
    return 'atlas';
  }

  if (source === 'sql') {
    return 'sql';
  }

  if (source === 'drizzle') {
    return databaseType === 'postgresql' ? 'drizzle' : databaseType === 'mysql' ? 'sql' : 'custom';
  }

  if (source === 'prisma') {
    return 'prisma';
  }

  if (source === 'knex') {
    return 'knex';
  }

  if (source === 'typeorm') {
    return 'typeorm';
  }

  return 'custom';
}

export function getDefaultSchemaConfigPath(source: SchemaSource): string | null {
  switch (source) {
    case 'atlas':
      return 'atlas.hcl';
    case 'prisma':
      return 'prisma/schema.prisma';
    default:
      return null;
  }
}

export function getSchemaConfigCandidates(source: SchemaSource): string[] {
  switch (source) {
    case 'atlas':
      return ['atlas.hcl'];
    case 'drizzle':
      return [...drizzleSchemaConfigCandidates];
    case 'prisma':
      return ['prisma/schema.prisma'];
    default:
      return [];
  }
}

export function resolveSpecificationSource(
  specification: Pick<MigrationSpecificationRecord, 'source' | 'tool'>
): SchemaSource {
  return (specification.source ?? specification.tool) as SchemaSource;
}

export function shouldShowSchemaConfigPath(source: SchemaSource): boolean {
  return source === 'atlas' || source === 'drizzle' || source === 'prisma';
}
