import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';

const expandMigrationPath = 'migrations/20260713120000_control_plane_durability.sql';
const contractMigrationPath = 'migrations/20260713121000_remove_plaintext_credentials.sql';
const atlasRunnerPath = 'src/lib/db/control-plane-atlas.ts';

describe('control-plane expand and contract migrations', () => {
  it('keeps destructive credential and legacy-table changes out of the expand phase', async () => {
    const sql = await readFile(expandMigrationPath, 'utf8');

    expect(sql).toContain('ALTER COLUMN "accessToken" DROP NOT NULL');
    expect(sql).not.toContain('DROP COLUMN "accessToken"');
    expect(sql).not.toContain('DROP TABLE "gitProvider"');
  });

  it('performs destructive cleanup only in the contract phase', async () => {
    const sql = await readFile(contractMigrationPath, 'utf8');

    expect(sql).toContain('DROP COLUMN "accessToken"');
    expect(sql).toContain('DROP COLUMN "refreshToken"');
    expect(sql).toContain('DROP TABLE "gitProvider"');
  });

  it('uses the Atlas apply version flag for the expand boundary', async () => {
    const source = await readFile(atlasRunnerPath, 'utf8');

    expect(source).toContain(
      "'apply',\n        '--to-version',\n        CREDENTIAL_ENVELOPE_VERSION"
    );
    expect(source).not.toContain("'apply',\n        '--to',\n        CREDENTIAL_ENVELOPE_VERSION");
  });
});
