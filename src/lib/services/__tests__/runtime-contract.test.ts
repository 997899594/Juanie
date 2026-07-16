import { describe, expect, it } from 'bun:test';
import { buildServiceRuntimeCommandSpec } from '@/lib/services/runtime-command';
import { getUnsafeRuntimeDatabaseInfrastructureChange } from '@/lib/services/runtime-contract';

describe('service runtime command contract', () => {
  it('turns juanie.yml run.command into the pod entrypoint contract', () => {
    expect(
      buildServiceRuntimeCommandSpec({
        name: 'worker',
        startCommand: 'bun .worker-runtime/start-workers.js',
      })
    ).toEqual({
      command: ['sh', '-lc'],
      args: ['bun .worker-runtime/start-workers.js'],
      displayCommand: 'bun .worker-runtime/start-workers.js',
    });
  });

  it('does not fall back to image CMD when run.command is missing', () => {
    expect(() =>
      buildServiceRuntimeCommandSpec({
        name: 'worker',
        startCommand: null,
      })
    ).toThrow('Service worker is missing run.command in juanie.yml');
  });
});

describe('runtime database contract safety', () => {
  it('blocks changing a managed database type through juanie.yml', () => {
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
        '数据库 "primary" 的基础设施类型不能通过 juanie.yml 直接从 PostgreSQL 改成 MySQL，请走显式迁移流程',
    });
  });

  it('blocks changing a supported provision type through juanie.yml', () => {
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
        '数据库 "primary" 的供应方式不能通过 juanie.yml 直接从 共享资源 改成 外部实例，请走显式迁移流程',
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
