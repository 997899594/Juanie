import type { EnvironmentSchemaStateStatus } from '@/lib/db/schema';

export interface SchemaLedgerClassificationInput {
  kind: 'drizzle' | 'sql';
  expectedEntries: string[];
  actualEntries: string[];
  hasUserTables: boolean;
}

export interface SchemaLedgerClassificationResult {
  status: EnvironmentSchemaStateStatus;
  summary: string;
  hasLedger: boolean;
  hasUserTables: boolean;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isPrefix(prefix: string[], values: string[]): boolean {
  return prefix.length <= values.length && prefix.every((value, index) => values[index] === value);
}

function describeKind(kind: SchemaLedgerClassificationInput['kind']): string {
  return kind === 'drizzle' ? 'Drizzle' : 'SQL';
}

export function classifySchemaLedgerState(
  input: SchemaLedgerClassificationInput
): SchemaLedgerClassificationResult {
  const hasLedger = input.actualEntries.length > 0;
  const toolLabel = describeKind(input.kind);

  if (input.expectedEntries.length === 0) {
    return {
      status: 'unmanaged',
      summary: `仓库中没有可追踪的 ${toolLabel} 迁移账本`,
      hasLedger,
      hasUserTables: input.hasUserTables,
    };
  }

  if (input.actualEntries.length === 0) {
    if (input.hasUserTables) {
      return {
        status: 'aligned_untracked',
        summary: `数据库已有业务表，但缺少 ${toolLabel} 迁移账本，需要人工接管`,
        hasLedger,
        hasUserTables: input.hasUserTables,
      };
    }

    return {
      status: 'unmanaged',
      summary: '数据库还没有可识别的业务表或迁移账本',
      hasLedger,
      hasUserTables: input.hasUserTables,
    };
  }

  if (arraysEqual(input.actualEntries, input.expectedEntries)) {
    return {
      status: 'aligned',
      summary: `数据库账本与仓库 ${toolLabel} 迁移链一致`,
      hasLedger,
      hasUserTables: input.hasUserTables,
    };
  }

  if (isPrefix(input.actualEntries, input.expectedEntries)) {
    return {
      status: 'pending_migrations',
      summary: `数据库落后于仓库迁移链，已执行 ${input.actualEntries.length}/${input.expectedEntries.length} 项，可通过正常发布补齐`,
      hasLedger,
      hasUserTables: input.hasUserTables,
    };
  }

  return {
    status: 'drifted',
    summary: `数据库账本与仓库 ${toolLabel} 迁移链不一致`,
    hasLedger,
    hasUserTables: input.hasUserTables,
  };
}
