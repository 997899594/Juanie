import { describe, expect, it } from 'bun:test';
import { isReleaseSchemaStateBlocking } from '@/lib/releases/schema-gate';

describe('release schema gate', () => {
  it('allows unmanaged empty databases for first release', () => {
    expect(
      isReleaseSchemaStateBlocking({
        databaseId: 'db-1',
        databaseName: 'primary',
        status: 'unmanaged',
        statusLabel: '未纳管',
        summary: '数据库还没有可识别的业务表或迁移账本',
        hasLedger: false,
        hasUserTables: false,
      })
    ).toBe(false);
  });

  it('continues blocking unmanaged databases with user tables', () => {
    expect(
      isReleaseSchemaStateBlocking({
        databaseId: 'db-1',
        databaseName: 'primary',
        status: 'unmanaged',
        statusLabel: '未纳管',
        summary: '数据库已有业务表，但还没有纳入门禁',
        hasLedger: false,
        hasUserTables: true,
      })
    ).toBe(true);
  });

  it('continues blocking drifted databases', () => {
    expect(
      isReleaseSchemaStateBlocking({
        databaseId: 'db-1',
        databaseName: 'primary',
        status: 'drifted',
        statusLabel: '已漂移',
        summary: '数据库账本与仓库迁移链不一致',
      })
    ).toBe(true);
  });
});
