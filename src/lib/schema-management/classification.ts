import type { EnvironmentSchemaStateStatus } from '@/lib/db/schema';

export interface SchemaLedgerClassificationInput {
  kind: 'atlas' | 'drizzle' | 'sql' | 'desired_schema';
  expectedEntries: string[];
  actualEntries: string[];
  hasUserTables: boolean;
  driftDetected: boolean;
  driftSummary?: string | null;
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
  if (kind === 'atlas') {
    return 'Atlas';
  }

  if (kind === 'drizzle') {
    return 'Drizzle';
  }

  return kind === 'desired_schema' ? 'desired schema' : 'SQL';
}

function appendDiffSummary(base: string, driftSummary?: string | null): string {
  return driftSummary ? `${base}：${driftSummary}` : base;
}

export function classifySchemaLedgerState(
  input: SchemaLedgerClassificationInput
): SchemaLedgerClassificationResult {
  const hasLedger = input.actualEntries.length > 0;
  const toolLabel = describeKind(input.kind);

  if (input.kind === 'desired_schema') {
    if (!input.driftDetected) {
      return {
        status: 'aligned',
        summary: 'Atlas diff 未发现 schema 差异，数据库结构与仓库 desired schema 一致',
        hasLedger: false,
        hasUserTables: input.hasUserTables,
      };
    }

    return {
      status: 'pending_migrations',
      summary: appendDiffSummary(
        '数据库尚未达到仓库 desired schema，可通过正常发布补齐',
        input.driftSummary
      ),
      hasLedger: false,
      hasUserTables: input.hasUserTables,
    };
  }

  if (input.expectedEntries.length === 0) {
    return {
      status: 'unmanaged',
      summary: `仓库中没有可追踪的 ${toolLabel} 迁移账本`,
      hasLedger,
      hasUserTables: input.hasUserTables,
    };
  }

  if (!input.driftDetected) {
    if (input.actualEntries.length === 0) {
      return {
        status: 'aligned_untracked',
        summary: `Atlas diff 未发现 schema 差异，但缺少 ${toolLabel} 迁移账本，需要人工接管`,
        hasLedger,
        hasUserTables: input.hasUserTables,
      };
    }

    if (arraysEqual(input.actualEntries, input.expectedEntries)) {
      return {
        status: 'aligned',
        summary: `Atlas diff 未发现 schema 差异，数据库结构与仓库 ${toolLabel} 迁移链一致`,
        hasLedger,
        hasUserTables: input.hasUserTables,
      };
    }

    return {
      status: 'aligned_untracked',
      summary: `Atlas diff 未发现 schema 差异，但数据库账本与仓库 ${toolLabel} 迁移链不一致，需要人工接管`,
      hasLedger,
      hasUserTables: input.hasUserTables,
    };
  }

  if (input.actualEntries.length === 0) {
    if (input.hasUserTables) {
      return {
        status: 'drifted',
        summary: appendDiffSummary(
          `Atlas diff 检测到 schema 差异，且缺少 ${toolLabel} 迁移账本`,
          input.driftSummary
        ),
        hasLedger,
        hasUserTables: input.hasUserTables,
      };
    }

    return {
      status: 'pending_migrations',
      summary: appendDiffSummary(
        `数据库尚未应用仓库 ${toolLabel} 迁移链，可通过正常发布补齐`,
        input.driftSummary
      ),
      hasLedger,
      hasUserTables: input.hasUserTables,
    };
  }

  if (isPrefix(input.actualEntries, input.expectedEntries)) {
    return {
      status: 'pending_migrations',
      summary: appendDiffSummary(
        `数据库落后于仓库迁移链，已执行 ${input.actualEntries.length}/${input.expectedEntries.length} 项，可通过正常发布补齐`,
        input.driftSummary
      ),
      hasLedger,
      hasUserTables: input.hasUserTables,
    };
  }

  return {
    status: 'drifted',
    summary: appendDiffSummary(`数据库账本与仓库 ${toolLabel} 迁移链不一致`, input.driftSummary),
    hasLedger,
    hasUserTables: input.hasUserTables,
  };
}
