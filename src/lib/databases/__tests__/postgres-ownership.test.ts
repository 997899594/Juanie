import { describe, expect, it, mock } from 'bun:test';
import {
  buildManagedPostgresDeprovisionStatements,
  buildManagedPostgresOwnershipStatements,
  buildManagedPostgresProvisionStatements,
  deprovisionManagedPostgresDatabase,
  shouldAssertManagedPostgresRuntimeAccess,
} from '@/lib/databases/postgres-ownership';

describe('managed postgres ownership repair', () => {
  it('avoids reassigning postgres-owned system objects', () => {
    const { adminStatements, databaseStatements } = buildManagedPostgresOwnershipStatements({
      databaseName: 'juanie_demo',
      owner: 'juanie_demo',
    });

    expect(adminStatements).toEqual(['ALTER DATABASE "juanie_demo" OWNER TO "juanie_demo"']);
    expect(
      databaseStatements.some((statement) => statement.includes('REASSIGN OWNED BY postgres'))
    ).toBe(false);
  });

  it('only targets public-schema objects that are not extension-managed', () => {
    const { databaseStatements } = buildManagedPostgresOwnershipStatements({
      databaseName: 'juanie_demo',
      owner: 'juanie_demo',
    });

    const combined = databaseStatements.join('\n');

    expect(combined).toContain("n.nspname = 'public'");
    expect(combined).toContain("dependency.deptype = 'e'");
    expect(combined).toContain('ALTER ROUTINE %I.%I(%s) OWNER TO %I');
    expect(combined).toContain('ALTER TYPE %I.%I OWNER TO %I');
  });

  it('provisions shared postgres with owner-first creation instead of runtime ownership repair', () => {
    const statements = buildManagedPostgresProvisionStatements({
      databaseName: 'juanie_demo',
      owner: 'juanie_demo',
      password: 'secret_pw',
    });

    expect(statements.roleCreateOrUpdate).toContain("target_role text := 'juanie_demo'");
    expect(statements.roleCreateOrUpdate).toContain("target_password text := 'secret_pw'");
    expect(statements.roleCreateOrUpdate).toContain(
      "format('CREATE ROLE %I LOGIN PASSWORD %L', target_role, target_password)"
    );
    expect(statements.roleCreateOrUpdate).toContain(
      "format('ALTER ROLE %I LOGIN PASSWORD %L', target_role, target_password)"
    );
    expect(statements.databaseCreate).toBe(
      'CREATE DATABASE "juanie_demo" OWNER "juanie_demo" ENCODING \'UTF8\' TEMPLATE template0'
    );
    expect(statements.databaseGrants).toEqual([
      'GRANT ALL PRIVILEGES ON DATABASE "juanie_demo" TO "juanie_demo"',
    ]);
  });

  it('escapes password literals correctly inside dynamic role SQL', () => {
    const statements = buildManagedPostgresProvisionStatements({
      databaseName: 'juanie_demo',
      owner: 'juanie_demo',
      password: "secret-pw'quoted",
    });

    expect(statements.roleCreateOrUpdate).toContain("target_password text := 'secret-pw''quoted'");
    expect(statements.roleCreateOrUpdate).toContain(
      "format('ALTER ROLE %I LOGIN PASSWORD %L', target_role, target_password)"
    );
    expect(statements.roleCreateOrUpdate).toContain(
      "format('CREATE ROLE %I LOGIN PASSWORD %L', target_role, target_password)"
    );
  });

  it('builds force-drop statements for managed shared postgres databases', () => {
    const statements = buildManagedPostgresDeprovisionStatements({
      databaseName: 'juanie_demo',
      ownerRoleName: 'juanie_demo',
      adminDatabaseName: 'juanie',
      adminRoleName: 'postgres',
    });

    expect(statements.databaseDropStatements).toEqual([
      'DROP DATABASE IF EXISTS "juanie_demo" WITH (FORCE)',
    ]);
    expect(statements.roleDropStatements).toEqual(['DROP ROLE IF EXISTS "juanie_demo"']);
  });

  it('does not target the control-plane database or admin role for deletion', () => {
    const statements = buildManagedPostgresDeprovisionStatements({
      databaseName: 'juanie',
      ownerRoleName: 'postgres',
      adminDatabaseName: 'juanie',
      adminRoleName: 'postgres',
    });

    expect(statements.databaseDropStatements).toEqual([]);
    expect(statements.roleDropStatements).toEqual([]);
  });

  it('drops managed shared postgres databases through the admin connection', async () => {
    const adminUnsafe = mock(async () => undefined);
    const adminEnd = mock(async () => undefined);
    const postgresUnsafe = mock(async () => undefined);
    const postgresEnd = mock(async () => undefined);
    const connect = mock((connectionString: string) => {
      if (connectionString.endsWith('/postgres')) {
        return { unsafe: postgresUnsafe, end: postgresEnd };
      }

      return { unsafe: adminUnsafe, end: adminEnd };
    });

    const result = await deprovisionManagedPostgresDatabase(
      {
        type: 'postgresql',
        provisionType: 'shared',
        host: 'postgres',
        databaseName: 'juanie_demo',
        username: 'juanie_demo',
      },
      {
        resolveAdminUrl: () => 'postgresql://postgres:secret@postgres:5432/juanie',
        connect,
      }
    );

    expect(result).toBe(true);
    expect((connect.mock?.calls ?? []).length).toBe(2);
    expect((adminUnsafe.mock?.calls ?? []).slice(-2).map(([statement]) => statement)).toEqual([
      'DROP DATABASE IF EXISTS "juanie_demo" WITH (FORCE)',
      'DROP ROLE IF EXISTS "juanie_demo"',
    ]);
    expect(
      (postgresUnsafe.mock?.calls ?? []).some(([statement]) =>
        String(statement).includes('DROP OWNED BY "juanie_demo"')
      )
    ).toBe(true);
    expect((adminEnd.mock?.calls ?? []).length).toBe(1);
    expect((postgresEnd.mock?.calls ?? []).length).toBe(1);
  });

  it('skips databases that are not hosted on the managed shared postgres instance', async () => {
    const connect = mock(() => {
      throw new Error('should not connect');
    });

    const result = await deprovisionManagedPostgresDatabase(
      {
        type: 'postgresql',
        provisionType: 'shared',
        host: 'external-postgres.example.com',
        databaseName: 'juanie_demo',
        username: 'juanie_demo',
      },
      {
        resolveAdminUrl: () => 'postgresql://postgres:secret@postgres:5432/juanie',
        connect,
      }
    );

    expect(result).toBe(false);
    expect((connect.mock?.calls ?? []).length).toBe(0);
  });

  it('only enables runtime ownership assertions for shared postgres', () => {
    expect(
      shouldAssertManagedPostgresRuntimeAccess({
        type: 'postgresql',
        provisionType: 'shared',
      })
    ).toBe(true);
    expect(
      shouldAssertManagedPostgresRuntimeAccess({
        type: 'postgresql',
        provisionType: 'external',
      })
    ).toBe(false);
    expect(
      shouldAssertManagedPostgresRuntimeAccess({
        type: 'mysql',
        provisionType: 'standalone',
      })
    ).toBe(false);
  });

  it('fails loudly when shared postgres cleanup is required but admin config is unavailable', async () => {
    let thrown: unknown = null;

    try {
      await deprovisionManagedPostgresDatabase(
        {
          type: 'postgresql',
          provisionType: 'shared',
          host: 'postgres',
          databaseName: 'juanie_demo',
          username: 'juanie_demo',
        },
        {
          resolveAdminUrl: () => {
            throw new Error('missing env');
          },
        }
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown instanceof Error).toBe(true);
    expect((thrown as Error).message).toContain('cannot deprovision shared PostgreSQL');
  });
});
