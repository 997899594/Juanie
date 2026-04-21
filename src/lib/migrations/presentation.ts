export function getMigrationPhaseLabel(value?: string | null): string {
  if (value === 'preDeploy') return '部署前';
  if (value === 'postDeploy') return '部署后';
  if (value === 'manual') return '手动阶段';
  return value ?? '未设置';
}

export function getSchemaSourceLabel(value?: string | null): string {
  if (value === 'atlas') return 'Atlas';
  if (value === 'drizzle') return 'Drizzle';
  if (value === 'prisma') return 'Prisma';
  if (value === 'knex') return 'Knex';
  if (value === 'typeorm') return 'TypeORM';
  if (value === 'sql') return 'SQL';
  if (value === 'custom') return 'Custom';
  return value ?? '未设置';
}

export function getMigrationExecutionModeLabel(value?: string | null): string {
  if (value === 'manual_platform') return '平台审批';
  if (value === 'external') return '外部执行';
  return '自动执行';
}

export function getMigrationCompatibilityLabel(value?: string | null): string {
  if (value === 'breaking') return '破坏性';
  return '向后兼容';
}

export function getMigrationApprovalPolicyLabel(value?: string | null): string {
  if (value === 'manual_in_production') return '生产需审批';
  return '自动审批';
}

export function getMigrationLockStrategyLabel(value?: string | null): string {
  if (value === 'db_advisory') return '数据库 Advisory 锁';
  return '平台锁';
}
