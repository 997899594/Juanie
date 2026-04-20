import { describe, expect, it } from 'bun:test';
import { getUnsafeRuntimeDatabaseInfrastructureChange } from '@/lib/services/runtime-contract';

describe('runtime database contract safety', () => {
  it('blocks changing a managed database type through juanie.yaml', () => {
    expect(
      getUnsafeRuntimeDatabaseInfrastructureChange(
        {
          name: 'primary',
          type: 'postgresql',
          provisionType: 'shared',
        },
        {
          name: 'primary',
          type: 'mysql',
          provisionType: 'standalone',
        }
      )
    ).toEqual({
      databaseName: 'primary',
      message:
        '数据库 "primary" 的基础设施类型不能通过 juanie.yaml 直接从 PostgreSQL 改成 MySQL，请走显式迁移流程',
    });
  });

  it('blocks changing a supported provision type through juanie.yaml', () => {
    expect(
      getUnsafeRuntimeDatabaseInfrastructureChange(
        {
          name: 'primary',
          type: 'postgresql',
          provisionType: 'shared',
        },
        {
          name: 'primary',
          type: 'postgresql',
          provisionType: 'external',
        }
      )
    ).toEqual({
      databaseName: 'primary',
      message:
        '数据库 "primary" 的供应方式不能通过 juanie.yaml 直接从 共享资源 改成 外部实例，请走显式迁移流程',
    });
  });

  it('allows healing legacy unsupported provision metadata', () => {
    expect(
      getUnsafeRuntimeDatabaseInfrastructureChange(
        {
          name: 'mysql',
          type: 'mysql',
          provisionType: 'shared',
        },
        {
          name: 'mysql',
          type: 'mysql',
          provisionType: 'standalone',
        }
      )
    ).toBe(null);
  });

  it('allows external databases to rotate connection details without infra mutation', () => {
    expect(
      getUnsafeRuntimeDatabaseInfrastructureChange(
        {
          name: 'analytics',
          type: 'mongodb',
          provisionType: 'external',
        },
        {
          name: 'analytics',
          type: 'mongodb',
          provisionType: 'external',
        }
      )
    ).toBe(null);
  });
});
