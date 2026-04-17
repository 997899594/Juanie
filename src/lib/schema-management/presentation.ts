import type { EnvironmentSchemaStateStatus } from '@/lib/db/schema';

export function getEnvironmentSchemaStateLabel(
  status: EnvironmentSchemaStateStatus | null | undefined
): string {
  switch (status) {
    case 'aligned':
      return '已对齐';
    case 'pending_migrations':
      return '待执行迁移';
    case 'aligned_untracked':
      return '账本缺失';
    case 'drifted':
      return '已漂移';
    case 'unmanaged':
      return '未纳管';
    case 'blocked':
      return '检查失败';
    default:
      return '未检查';
  }
}
