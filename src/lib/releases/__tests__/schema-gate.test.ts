import { describe, expect, it } from 'bun:test';
import {
  buildReleaseSchemaGateSnapshot,
  isReleaseSchemaGateRefreshUnavailable,
  isReleaseSchemaGateWaitingForRefresh,
  isReleaseSchemaStateBlocking,
  isStoredSchemaStateForRequestedRevision,
} from '@/lib/releases/schema-gate';
import { buildSchemaRevisionKey } from '@/lib/schema-management/revision';

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

  it('only trusts stored schema state for the requested commit', () => {
    expect(
      isStoredSchemaStateForRequestedRevision(
        {
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'abc123',
        } as Parameters<typeof isStoredSchemaStateForRequestedRevision>[0],
        {
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'abc123',
        }
      )
    ).toBe(true);

    expect(
      isStoredSchemaStateForRequestedRevision(
        {
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'old123',
        } as Parameters<typeof isStoredSchemaStateForRequestedRevision>[0],
        {
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'new123',
        }
      )
    ).toBe(false);
  });

  it('uses commit-scoped revision keys before ref-scoped schema state', () => {
    expect(
      buildSchemaRevisionKey({
        sourceRef: 'refs/heads/main',
        sourceCommitSha: 'abc123',
      })
    ).toBe('commit:abc123');

    expect(
      buildSchemaRevisionKey({
        sourceRef: 'refs/heads/main',
      })
    ).toBe('ref:refs/heads/main');
  });

  it('allows release creation while current revision schema inspection is refreshing', () => {
    const snapshot = buildReleaseSchemaGateSnapshot(
      [
        {
          databaseId: 'db-1',
          databaseName: 'primary',
          status: 'unknown',
          statusLabel: '待检查',
          summary: '尚未有当前版本的 schema 检查结果，已请求后台刷新。',
          freshness: 'missing',
          refreshStatus: 'queued',
        },
      ],
      {
        requested: true,
        queuedCount: 1,
        missingCount: 1,
      }
    );

    expect(snapshot.canCreate).toBe(true);
    expect(snapshot.blockingReason).toBe(null);
    expect(snapshot.blockingCount).toBe(0);
    expect(snapshot.nextActionLabel).toBe('等待 Schema 检查完成');
    expect(snapshot.customSignals.some((chip) => chip.key === 'schema:refreshing')).toBe(true);
    expect(isReleaseSchemaGateWaitingForRefresh(snapshot)).toBe(true);
    expect(isReleaseSchemaGateRefreshUnavailable(snapshot)).toBe(false);
  });

  it('requires a schema refresh request before allowing missing revision state', () => {
    const snapshot = buildReleaseSchemaGateSnapshot(
      [
        {
          databaseId: 'db-1',
          databaseName: 'primary',
          status: 'unknown',
          statusLabel: '待检查',
          summary: '尚未有当前版本的 schema 检查结果。',
          freshness: 'missing',
          refreshStatus: 'idle',
        },
      ],
      {
        requested: false,
        missingCount: 1,
      }
    );

    expect(snapshot.canCreate).toBe(false);
    expect(snapshot.blockingReason).toBe('数据库 schema 尚未检查，请刷新检查后再创建发布');
    expect(snapshot.nextActionLabel).toBe('刷新 Schema 检查');
    expect(snapshot.customSignals.some((chip) => chip.key === 'schema:unknown')).toBe(true);
    expect(isReleaseSchemaGateWaitingForRefresh(snapshot)).toBe(false);
  });

  it('does not classify unavailable schema inspection as pending refresh', () => {
    const snapshot = buildReleaseSchemaGateSnapshot(
      [
        {
          databaseId: 'db-1',
          databaseName: 'primary',
          status: 'blocked',
          statusLabel: '检查失败',
          summary: '尚未有当前版本的 schema 检查结果。',
          freshness: 'missing',
          refreshStatus: 'unavailable',
        },
      ],
      {
        requested: true,
        unavailableCount: 1,
        missingCount: 1,
      }
    );

    expect(snapshot.canCreate).toBe(false);
    expect(snapshot.blockingReason).toBe('数据库 schema 检查不可用，请查看环境数据库诊断');
    expect(snapshot.nextActionLabel).toBe('查看数据库诊断');
    expect(snapshot.customSignals.some((chip) => chip.key === 'schema:refresh-failed')).toBe(true);
    expect(isReleaseSchemaGateWaitingForRefresh(snapshot)).toBe(false);
    expect(isReleaseSchemaGateRefreshUnavailable(snapshot)).toBe(true);
  });
});
