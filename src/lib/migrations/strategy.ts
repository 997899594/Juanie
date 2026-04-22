import type { DatabaseType } from '@/lib/db/schema';
import { isPlatformManagedMigrationTool } from './platform-managed';
import {
  resolveExecutionToolForSchemaSource,
  type SchemaSource,
  schemaSources,
} from './schema-source';

const schemaSourceRecommendationOrder: SchemaSource[] = [
  'drizzle',
  'atlas',
  'sql',
  'prisma',
  'knex',
  'typeorm',
  'custom',
];

function supportsAtlasSchemaGovernance(databaseType: DatabaseType): boolean {
  return databaseType === 'postgresql' || databaseType === 'mysql';
}

function buildGovernanceTail(databaseType: DatabaseType): string {
  if (supportsAtlasSchemaGovernance(databaseType)) {
    return '平台仍会统一用 Atlas 做 diff / repair / adopt 治理，而不是要求子应用把发布主链统一改成 Atlas。';
  }

  return `当前 ${databaseType} 还不支持平台内 schema 治理，请保持 external，并由子应用或外部流程负责迁移与修复。`;
}

export function canPlatformExecuteSchemaSource(
  source: SchemaSource,
  databaseType: DatabaseType
): boolean {
  const executionTool = resolveExecutionToolForSchemaSource(source, databaseType);
  return isPlatformManagedMigrationTool(executionTool, databaseType);
}

export function getPlatformManagedSchemaSources(databaseType: DatabaseType): SchemaSource[] {
  return [...schemaSources]
    .filter((source) => canPlatformExecuteSchemaSource(source, databaseType))
    .sort(
      (left, right) =>
        schemaSourceRecommendationOrder.indexOf(left) -
        schemaSourceRecommendationOrder.indexOf(right)
    );
}

export function formatPlatformManagedSchemaSources(databaseType: DatabaseType): string | null {
  const sources = getPlatformManagedSchemaSources(databaseType);
  return sources.length > 0 ? sources.join(' / ') : null;
}

export function buildUnsupportedManagedSchemaSourceMessage(input: {
  serviceName: string;
  source: SchemaSource;
  databaseType: DatabaseType;
  databaseName?: string | null;
}): string {
  const scope = input.databaseName
    ? `Service "${input.serviceName}" 绑定的数据库 "${input.databaseName}" (${input.databaseType}) 当前不支持以 schema.source=${input.source} 由平台直接执行迁移`
    : `Service "${input.serviceName}" 的 schema.source=${input.source} 目前无法由平台直接执行 ${input.databaseType} 迁移`;
  const supportedSources = formatPlatformManagedSchemaSources(input.databaseType);

  if (!supportedSources) {
    return `${scope}。请改为 external；当前 ${input.databaseType} 还没有平台托管迁移执行器。${buildGovernanceTail(input.databaseType)}`;
  }

  return `${scope}。请改为 external，或改用平台当前支持的托管发布主链 schema.source=${supportedSources}。${buildGovernanceTail(input.databaseType)}`;
}

export function buildSchemaContractCommentLines(indent = ''): string[] {
  return [
    `${indent}# Juanie could not infer a tracked schema source for this service.`,
    `${indent}# Add schema.source manually; the app keeps its own migration truth, and Juanie uses Atlas for diff / repair workflows.`,
  ];
}
