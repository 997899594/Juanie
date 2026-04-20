import { describe, expect, it } from 'bun:test';
import {
  assertDeclaredDatabaseRuntimeAccess,
  resolveDatabaseRuntimeAccessValidationDepth,
  verifyDeclaredDatabaseRuntimeAccess,
} from '@/lib/databases/runtime-access';

interface TestDatabaseInput {
  name?: string;
  type?: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  provisionType?: 'shared' | 'standalone' | 'external';
  connectionString?: string | null;
}

function buildDatabase(input: TestDatabaseInput = {}) {
  return {
    id: 'db_test',
    name: input.name ?? 'primary',
    type: input.type ?? 'postgresql',
    provisionType: input.provisionType ?? 'external',
    connectionString:
      input.connectionString === undefined
        ? 'postgresql://postgres:secret@127.0.0.1:5432/app'
        : input.connectionString,
  };
}

describe('database runtime access validation', () => {
  it('uses truthful validation depth for each database runtime contract', () => {
    expect(
      resolveDatabaseRuntimeAccessValidationDepth(
        buildDatabase({ type: 'postgresql', provisionType: 'shared' })
      )
    ).toBe('skipped');
    expect(resolveDatabaseRuntimeAccessValidationDepth(buildDatabase())).toBe('protocol_handshake');
    expect(
      resolveDatabaseRuntimeAccessValidationDepth(
        buildDatabase({
          type: 'redis',
          connectionString: 'redis://:secret@127.0.0.1:6379/0',
        })
      )
    ).toBe('protocol_handshake');
    expect(
      resolveDatabaseRuntimeAccessValidationDepth(
        buildDatabase({
          type: 'mysql',
          connectionString: 'mysql://root:secret@127.0.0.1:3306/app',
        })
      )
    ).toBe('protocol_handshake');
    expect(
      resolveDatabaseRuntimeAccessValidationDepth(
        buildDatabase({
          type: 'mongodb',
          connectionString: 'mongodb://127.0.0.1:27017/app',
        })
      )
    ).toBe('protocol_handshake');
    expect(
      resolveDatabaseRuntimeAccessValidationDepth(
        buildDatabase({
          type: 'mongodb',
          connectionString: 'mongodb+srv://user:secret@cluster.example.com/app',
        })
      )
    ).toBe('protocol_handshake');
  });

  it('fails fast when an external database is missing its connection string', async () => {
    const result = await verifyDeclaredDatabaseRuntimeAccess(
      buildDatabase({
        type: 'redis',
        connectionString: null,
      })
    );

    expect(result.validated).toBe(true);
    expect(result.satisfied).toBe(false);
    expect(result.depth).toBe('protocol_handshake');
    expect(result.issues[0]?.message).toContain('缺少连接串');
  });

  it('uses protocol-level handshake for external PostgreSQL', async () => {
    const calls: string[] = [];
    const result = await verifyDeclaredDatabaseRuntimeAccess(buildDatabase(), {
      probePostgres: async (connectionString) => {
        calls.push(connectionString);
      },
    });

    expect(result.validated).toBe(true);
    expect(result.satisfied).toBe(true);
    expect(result.depth).toBe('protocol_handshake');
    expect(calls).toEqual(['postgresql://postgres:secret@127.0.0.1:5432/app']);
  });

  it('uses protocol-level handshake for external MySQL', async () => {
    const calls: string[] = [];
    const result = await verifyDeclaredDatabaseRuntimeAccess(
      buildDatabase({
        type: 'mysql',
        connectionString: 'mysql://root:secret@127.0.0.1:3306/app',
      }),
      {
        probeMysql: async (connectionString) => {
          calls.push(connectionString);
        },
      }
    );

    expect(result.validated).toBe(true);
    expect(result.satisfied).toBe(true);
    expect(result.depth).toBe('protocol_handshake');
    expect(calls).toEqual(['mysql://root:secret@127.0.0.1:3306/app']);
  });

  it('uses protocol-level handshake for external MongoDB including srv urls', async () => {
    const calls: string[] = [];
    const result = await verifyDeclaredDatabaseRuntimeAccess(
      buildDatabase({
        type: 'mongodb',
        connectionString: 'mongodb+srv://user:secret@cluster.example.com/app',
      }),
      {
        probeMongo: async (connectionString) => {
          calls.push(connectionString);
        },
      }
    );

    expect(result.validated).toBe(true);
    expect(result.satisfied).toBe(true);
    expect(result.depth).toBe('protocol_handshake');
    expect(calls).toEqual(['mongodb+srv://user:secret@cluster.example.com/app']);
  });

  it('throws a user-facing error when runtime access validation fails', async () => {
    try {
      await assertDeclaredDatabaseRuntimeAccess(
        buildDatabase({
          type: 'redis',
          name: 'cache',
          connectionString: 'redis://:secret@127.0.0.1:6379/0',
        }),
        {
          probeRedis: async () => {
            throw new Error('NOAUTH Authentication required.');
          },
        }
      );
      throw new Error('expected runtime access assertion to fail');
    } catch (error) {
      expect(error instanceof Error ? error.message : String(error)).toContain(
        '数据库 "cache" 运行时访问校验失败'
      );
    }
  });
});
