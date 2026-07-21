import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';

const migrationPath = 'migrations/20260721163000_reconcile_release_migration_plan_schema.sql';
const uniqueConstraintReconciliationPath =
  'migrations/20260721162900_attach_environment_schema_state_unique_constraint.sql';

describe('control-plane release migration plan schema convergence', () => {
  it('converges both historical schema states through guarded forward-only DDL', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain(`CREATE TYPE "public"."releaseMigrationPlanStatus" AS ENUM`);
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "releaseMigrationPlan"`);
    expect(sql).toContain(`ADD COLUMN IF NOT EXISTS "releaseMigrationPlanId" uuid`);
    expect(sql).toContain(`migrationRun_releaseMigrationPlanId_releaseMigrationPlan_id_fk`);
    expect(sql).toContain(`CREATE INDEX IF NOT EXISTS "migrationRun_releaseMigrationPlanId_idx"`);
    expect(sql).toContain(`CREATE INDEX IF NOT EXISTS "releaseMigrationPlan_status_idx"`);
  });

  it('guards every named constraint that may already exist in the extended history', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const constraintNames = [
      'releaseMigrationPlan_pkey',
      'releaseMigrationPlan_release_unique',
      'releaseMigrationPlan_releaseId_release_id_fk',
      'releaseMigrationPlan_projectId_project_id_fk',
      'releaseMigrationPlan_environmentId_environment_id_fk',
      'releaseMigrationPlan_approvedByUserId_user_id_fk',
      'migrationRun_releaseMigrationPlanId_releaseMigrationPlan_id_fk',
      'environmentSchemaState_database_unique',
    ];

    for (const constraintName of constraintNames) {
      expect(sql).toContain(`conname = '${constraintName}'`);
    }
  });

  it('promotes only the exact historical unique index into the table constraint', async () => {
    const sql = await readFile(uniqueConstraintReconciliationPath, 'utf8');

    expect(sql).toContain('juanie:history-reconciliation-through 20260717090000');
    expect(sql).toContain('named_relation.indisunique');
    expect(sql).toContain('named_relation.indisvalid');
    expect(sql).toContain('named_relation.indisready');
    expect(sql).toContain('named_relation.indnkeyatts <> 1');
    expect(sql).toContain('named_relation.indnatts <> 1');
    expect(sql).toContain('named_relation.indkey[0] <> database_attribute_number');
    expect(sql).toContain('named_relation.indexprs IS NOT NULL');
    expect(sql).toContain('named_relation.indpred IS NOT NULL');
    expect(sql).toContain('UNIQUE USING INDEX "environmentSchemaState_database_unique"');
    expect(sql).toContain('exists with an incompatible index definition');
  });
});
