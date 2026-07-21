import { describe, expect, it } from 'bun:test';
import {
  buildExpectedControlPlaneSchemaContract,
  findControlPlaneSchemaContractViolations,
  type ObservedControlPlaneSchema,
} from '@/lib/db/control-plane-schema-contract';

function observeExpectedContract(): ObservedControlPlaneSchema {
  const expected = buildExpectedControlPlaneSchemaContract();
  return {
    tables: expected.tables.map((table) => table.name),
    columns: expected.tables.flatMap((table) =>
      table.columns.map((column) => ({
        tableName: table.name,
        name: column.name,
        sqlType: column.sqlType,
        notNull: column.notNull,
        hasDefault: column.databaseDefaultRequired,
      }))
    ),
    constraints: expected.tables.flatMap((table) =>
      table.constraints.map((constraint) => ({ tableName: table.name, ...constraint }))
    ),
    indexes: expected.tables.flatMap((table) =>
      table.indexes.map((name) => ({ tableName: table.name, name }))
    ),
    enums: expected.enums.map((pgEnum) => ({ name: pgEnum.name, values: [...pgEnum.values] })),
  };
}

describe('control-plane schema contract', () => {
  it('derives release migration plan requirements from Drizzle metadata', () => {
    const expected = buildExpectedControlPlaneSchemaContract();
    const planTable = expected.tables.find((table) => table.name === 'releaseMigrationPlan');
    const runTable = expected.tables.find((table) => table.name === 'migrationRun');
    const statusEnum = expected.enums.find(
      (pgEnum) => pgEnum.name === 'releaseMigrationPlanStatus'
    );

    expect(planTable?.columns.find((column) => column.name === 'status')?.sqlType).toBe(
      'releaseMigrationPlanStatus'
    );
    expect(runTable?.columns.find((column) => column.name === 'releaseMigrationPlanId')).toEqual({
      name: 'releaseMigrationPlanId',
      sqlType: 'uuid',
      notNull: false,
      databaseDefaultRequired: false,
    });
    expect(runTable?.indexes).toContain('migrationRun_releaseMigrationPlanId_idx');
    expect(runTable?.constraints.map((constraint) => constraint.name)).toContain(
      'migrationRun_releaseMigrationPlanId_releaseMigrationPlan_id_fk'
    );
    expect(statusEnum?.values).toEqual([
      'awaiting_approval',
      'approved',
      'executing',
      'completed',
      'failed',
      'superseded',
    ]);
  });

  it('accepts a matching schema plus expand-compatible extra objects', () => {
    const expected = buildExpectedControlPlaneSchemaContract();
    const observed = observeExpectedContract();
    observed.tables.push('legacyCompatibilityTable');
    observed.constraints = observed.constraints.map((constraint, index) => ({
      ...constraint,
      name: `historical_constraint_${index}`,
    }));
    observed.enums = observed.enums.map((pgEnum) => ({
      ...pgEnum,
      values: [...pgEnum.values].reverse(),
    }));

    expect(findControlPlaneSchemaContractViolations(expected, observed)).toEqual([]);
  });

  it('reports missing and incompatible runtime requirements without row data', () => {
    const expected = buildExpectedControlPlaneSchemaContract();
    const observed = observeExpectedContract();
    observed.tables = observed.tables.filter((table) => table !== 'releaseMigrationPlan');
    observed.columns = observed.columns.filter(
      (column) => !(column.tableName === 'migrationRun' && column.name === 'releaseMigrationPlanId')
    );
    observed.enums = observed.enums.map((pgEnum) =>
      pgEnum.name === 'releaseMigrationPlanStatus'
        ? { ...pgEnum, values: ['awaiting_approval'] }
        : pgEnum
    );

    const violations = findControlPlaneSchemaContractViolations(expected, observed);

    expect(violations).toContain('missing table public.releaseMigrationPlan');
    expect(violations).toContain('missing column public.migrationRun.releaseMigrationPlanId');
    expect(violations).toContain(
      'incompatible enum public.releaseMigrationPlanStatus: missing required labels [approved, executing, completed, failed, superseded]'
    );
  });
});
