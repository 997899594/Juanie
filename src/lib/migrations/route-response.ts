import { NextResponse } from 'next/server';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import {
  isMigrationControlError,
  isRuntimeDatabaseContractSyncBlockedError,
  type MigrationRunAction,
} from '@/lib/migrations/control-service';

export function getMigrationActionResponseStatus(action: 'run' | MigrationRunAction): 200 | 202 {
  return action === 'mark_external_complete' || action === 'mark_external_failed' ? 200 : 202;
}

export function toMigrationRouteErrorResponse(
  error: unknown,
  fallbackMessage = '迁移操作失败'
): NextResponse {
  if (isAccessError(error)) {
    return toAccessErrorResponse(error);
  }

  if (isMigrationControlError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (isRuntimeDatabaseContractSyncBlockedError(error)) {
    return NextResponse.json(
      { error: error.message || '数据库运行时合同同步被阻止' },
      { status: 409 }
    );
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}
