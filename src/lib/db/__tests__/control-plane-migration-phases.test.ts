import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';

const expandMigrationPath = 'migrations/20260713120000_control_plane_durability.sql';
const contractMigrationPath = 'migrations/20260713121000_remove_plaintext_credentials.sql';
const reconciliationMigrationPath = 'migrations/20260714130000_reconcile_control_plane_history.sql';
const atlasRunnerPath = 'src/lib/db/control-plane-atlas.ts';
const schemaJobPath = 'deploy/k8s/charts/juanie/templates/schema-sync-job.yaml';
const environmentKeyVersionMigrationPath =
  'migrations/20260723092304_environment_variable_key_version.sql';
const environmentKeyVersionContractPath =
  'migrations-contract/20260723000000_require_environment_secret_key_version.sql';

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

  it('uses the platform-owned bounded apply planner for the expand boundary', async () => {
    const source = await readFile(atlasRunnerPath, 'utf8');

    expect(source).toContain('applyControlPlaneMigrationsThroughVersion(');
    expect(source).toContain('resolveAtlasBoundedMigrationCount({');
    expect(source).not.toContain("'--to-version'");
  });

  it('uses a checkpoint baseline for the known out-of-order Atlas lineage', async () => {
    const migration = await readFile(reconciliationMigrationPath, 'utf8');
    const source = await readFile(atlasRunnerPath, 'utf8');

    expect(migration).toContain('juanie:history-reconciliation-through 20260714120000');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "accessTokenEncrypted"');
    expect(source).toContain('await migrateCredentialEnvelopes(databaseUrl)');
    expect(source).toContain("usesReconciledHistory ? 'linear-skip' : undefined");
  });

  it('keeps contract promotion out of the default Helm release', async () => {
    const schemaJob = await readFile(schemaJobPath, 'utf8');
    const source = await readFile(atlasRunnerPath, 'utf8');

    expect(schemaJob).toContain('.Values.schemaSync.contractPromotionEpoch');
    expect(schemaJob).toContain('CONTROL_PLANE_CONTRACT_PROMOTION');
    expect(source).toContain('Contract migration requires explicit promotion epoch');
  });

  it('adds the environment key version in expand and enforces it only in contract', async () => {
    const migration = await readFile(environmentKeyVersionMigrationPath, 'utf8');
    const contract = await readFile(environmentKeyVersionContractPath, 'utf8');
    const schemaJob = await readFile(schemaJobPath, 'utf8');

    expect(migration).toContain('ADD COLUMN "encryptionKeyVersion" integer NULL');
    expect(migration).not.toContain('SET NOT NULL');
    expect(contract).toContain('"encryptionKeyVersion" IS NOT NULL');
    expect(contract).toContain(
      'VALIDATE CONSTRAINT "environmentVariable_secret_envelope_versioned"'
    );
    expect(contract).toContain('RENAME CONSTRAINT "environmentVariable_secret_envelope_versioned"');
    expect(schemaJob).not.toContain('ENCRYPTION_MASTER_KEY_V0');
    expect(schemaJob).not.toContain('juanie-master-key');
  });

  it('validates contract migrations on top of the expanded control-plane schema', async () => {
    const source = await readFile(atlasRunnerPath, 'utf8');

    const helper = source.slice(
      source.indexOf('async function validateContractMigrationsAgainstExpandedSchema'),
      source.indexOf('export async function validateControlPlaneMigrations')
    );
    expect(
      helper.indexOf('MIGRATIONS_DIR_URL') < helper.indexOf('CONTRACT_MIGRATIONS_DIR_URL')
    ).toBe(true);
    expect(helper).toContain('CONTRACT_REVISIONS_SCHEMA');
    expect(helper).toContain('ensureContractAtlasBaseline(devUrl, options)');
  });

  it('verifies runtime schema compatibility after expand and contract execution', async () => {
    const source = await readFile(atlasRunnerPath, 'utf8');

    expect(source.match(/await verifyControlPlaneReleaseGate\(databaseUrl\)/gu)?.length).toBe(2);
  });
});
