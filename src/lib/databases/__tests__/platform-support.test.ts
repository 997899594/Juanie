import { describe, expect, it } from 'bun:test';
import {
  getDatabaseSelectionValidationIssues,
  getDefaultDatabaseProvisionType,
  getUnsupportedPreviewCloneDatabases,
  validateExternalDatabaseUrl,
} from '@/lib/databases/platform-support';

describe('database platform support', () => {
  it('uses truthful default provision types', () => {
    expect(getDefaultDatabaseProvisionType('postgresql')).toBe('shared');
    expect(getDefaultDatabaseProvisionType('redis')).toBe('shared');
    expect(getDefaultDatabaseProvisionType('mysql')).toBe('standalone');
    expect(getDefaultDatabaseProvisionType('mongodb')).toBe('external');
  });

  it('rejects unsupported database provision combinations', () => {
    expect(
      getDatabaseSelectionValidationIssues({
        type: 'mysql',
        provisionType: 'shared',
      })
    ).toEqual([
      {
        code: 'unsupported_provision_type',
        message: 'MySQL 目前只支持 独立资源、外部实例，不支持 共享资源',
      },
    ]);

    expect(
      getDatabaseSelectionValidationIssues({
        type: 'mongodb',
        provisionType: 'standalone',
      })
    ).toEqual([
      {
        code: 'unsupported_provision_type',
        message: 'MongoDB 目前只支持 外部实例，不支持 独立资源',
      },
    ]);
  });

  it('requires external urls for external databases', () => {
    expect(
      getDatabaseSelectionValidationIssues({
        type: 'mongodb',
      })
    ).toEqual([
      {
        code: 'external_url_required',
        message: '外部数据库必须提供 externalUrl 连接串',
      },
    ]);
  });

  it('validates external url protocols by database type', () => {
    expect(validateExternalDatabaseUrl('postgresql', 'postgresql://user:pass@host:5432/db')).toBe(
      null
    );
    expect(validateExternalDatabaseUrl('redis', 'rediss://:pass@host:6379/1')).toBe(null);
    expect(validateExternalDatabaseUrl('mongodb', 'mongodb+srv://user:pass@cluster/db')).toBe(null);

    expect(
      getDatabaseSelectionValidationIssues({
        type: 'mysql',
        provisionType: 'external',
        externalUrl: 'postgresql://user:pass@host:5432/db',
      })
    ).toEqual([
      {
        code: 'invalid_external_url',
        message: 'MySQL 外部连接串必须使用 mysql: 协议',
      },
    ]);
  });

  it('only allows preview clones for managed postgresql', () => {
    expect(
      getUnsupportedPreviewCloneDatabases([
        {
          name: 'primary',
          type: 'postgresql',
          provisionType: 'shared',
        },
      ])
    ).toEqual([]);

    expect(
      getUnsupportedPreviewCloneDatabases([
        {
          name: 'cache',
          type: 'redis',
          provisionType: 'shared',
        },
        {
          name: 'external-pg',
          type: 'postgresql',
          provisionType: 'external',
        },
      ])
    ).toEqual([
      {
        name: 'cache',
        type: 'redis',
        provisionType: 'shared',
        reason: '独立预览库当前只支持平台托管 PostgreSQL',
      },
      {
        name: 'external-pg',
        type: 'postgresql',
        provisionType: 'external',
        reason: '外部 PostgreSQL 暂不支持独立预览库，请改为平台托管 PostgreSQL 或使用继承模式',
      },
    ]);
  });
});
