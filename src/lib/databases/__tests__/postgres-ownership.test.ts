import { describe, expect, it } from 'bun:test';
import {
  buildManagedPostgresOwnershipStatements,
  buildManagedPostgresProvisionStatements,
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

    expect(statements.roleCreateOrUpdate).toContain('CREATE ROLE "juanie_demo" LOGIN PASSWORD');
    expect(statements.roleCreateOrUpdate).toContain('ALTER ROLE "juanie_demo" LOGIN PASSWORD');
    expect(statements.databaseCreate).toBe(
      'CREATE DATABASE "juanie_demo" OWNER "juanie_demo" ENCODING \'UTF8\' TEMPLATE template0'
    );
    expect(statements.databaseGrants).toEqual([
      'GRANT ALL PRIVILEGES ON DATABASE "juanie_demo" TO "juanie_demo"',
    ]);
  });
});
