import { is } from 'drizzle-orm';
import { getTableConfig, isPgEnum, PgTable } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schemaEnums from '@/lib/db/schema/enums';
import * as schemaTables from '@/lib/db/schema/tables';

const contractSchema = 'public';
const maxReportedViolations = 50;

export interface ExpectedControlPlaneColumn {
  name: string;
  sqlType: string;
  notNull: boolean;
  databaseDefaultRequired: boolean;
}

export interface ExpectedControlPlaneTable {
  name: string;
  columns: ExpectedControlPlaneColumn[];
  constraints: ExpectedControlPlaneConstraint[];
  indexes: string[];
}

export interface ExpectedControlPlaneConstraint {
  name: string;
  type: 'primary_key' | 'unique' | 'foreign_key';
  columns: string[];
  referencedTable: string | null;
  referencedColumns: string[];
  onDelete: string;
  onUpdate: string;
}

export interface ExpectedControlPlaneEnum {
  name: string;
  values: string[];
}

export interface ExpectedControlPlaneSchemaContract {
  tables: ExpectedControlPlaneTable[];
  enums: ExpectedControlPlaneEnum[];
}

export interface ObservedControlPlaneColumn {
  tableName: string;
  name: string;
  sqlType: string;
  notNull: boolean;
  hasDefault: boolean;
}

export interface ObservedControlPlaneSchema {
  tables: string[];
  columns: ObservedControlPlaneColumn[];
  constraints: Array<ExpectedControlPlaneConstraint & { tableName: string }>;
  indexes: Array<{ tableName: string; name: string }>;
  enums: Array<{ name: string; values: string[] }>;
}

interface CatalogColumnRow {
  tableName: string;
  columnName: string;
  dataType: string;
  udtName: string;
  characterMaximumLength: number | null;
  notNull: boolean;
  hasDefault: boolean;
}

function normalizeExpectedSqlType(sqlType: string): string {
  return sqlType === 'bigserial' ? 'bigint' : sqlType;
}

function normalizeObservedSqlType(row: CatalogColumnRow): string {
  if (row.dataType === 'USER-DEFINED') {
    return row.udtName;
  }
  if (row.dataType === 'character varying') {
    return row.characterMaximumLength ? `varchar(${row.characterMaximumLength})` : 'varchar';
  }
  if (row.dataType === 'timestamp without time zone') {
    return 'timestamp';
  }
  return row.dataType;
}

function requireContractObjectName(name: string | undefined, kind: string): string {
  if (!name) {
    throw new Error(`Control-plane ${kind} must declare a stable database name`);
  }
  return name;
}

function normalizeReferentialAction(action: string | undefined): string {
  return (action ?? 'no action').trim().toLowerCase().replaceAll(' ', '_');
}

function constraintSignature(constraint: Omit<ExpectedControlPlaneConstraint, 'name'>): string {
  return JSON.stringify([
    constraint.type,
    constraint.columns,
    constraint.referencedTable,
    constraint.referencedColumns,
    constraint.onDelete,
    constraint.onUpdate,
  ]);
}

export function buildExpectedControlPlaneSchemaContract(): ExpectedControlPlaneSchemaContract {
  const tableDefinitions: PgTable[] = [];
  for (const value of Object.values(schemaTables) as unknown[]) {
    if (is(value, PgTable)) tableDefinitions.push(value);
  }

  const tables = tableDefinitions
    .map((table) => {
      const config = getTableConfig(table);
      const constraints: ExpectedControlPlaneConstraint[] = [];

      for (const column of config.columns) {
        if (column.primary) {
          constraints.push({
            name: `${config.name}_pkey`,
            type: 'primary_key',
            columns: [column.name],
            referencedTable: null,
            referencedColumns: [],
            onDelete: 'no_action',
            onUpdate: 'no_action',
          });
        }
      }
      for (const primaryKey of config.primaryKeys) {
        constraints.push({
          name: requireContractObjectName(primaryKey.getName(), 'primary key'),
          type: 'primary_key',
          columns: primaryKey.columns.map((column) => column.name),
          referencedTable: null,
          referencedColumns: [],
          onDelete: 'no_action',
          onUpdate: 'no_action',
        });
      }
      for (const foreignKey of config.foreignKeys) {
        const reference = foreignKey.reference();
        constraints.push({
          name: foreignKey.getName(),
          type: 'foreign_key',
          columns: reference.columns.map((column) => column.name),
          referencedTable: getTableConfig(reference.foreignTable).name,
          referencedColumns: reference.foreignColumns.map((column) => column.name),
          onDelete: normalizeReferentialAction(foreignKey.onDelete),
          onUpdate: normalizeReferentialAction(foreignKey.onUpdate),
        });
      }
      for (const uniqueConstraint of config.uniqueConstraints) {
        constraints.push({
          name: requireContractObjectName(uniqueConstraint.getName(), 'unique constraint'),
          type: 'unique',
          columns: uniqueConstraint.columns.map((column) => column.name),
          referencedTable: null,
          referencedColumns: [],
          onDelete: 'no_action',
          onUpdate: 'no_action',
        });
      }

      return {
        name: config.name,
        columns: config.columns
          .map((column) => ({
            name: column.name,
            sqlType: normalizeExpectedSqlType(column.getSQLType()),
            notNull: column.notNull,
            databaseDefaultRequired:
              column.default !== undefined || column.getSQLType() === 'bigserial',
          }))
          .sort((left, right) => left.name.localeCompare(right.name)),
        constraints: constraints.sort((left, right) => left.name.localeCompare(right.name)),
        indexes: config.indexes
          .map((index) => requireContractObjectName(index.config.name, 'index'))
          .sort(),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const enumDefinitions = (Object.values(schemaEnums) as unknown[]).filter(isPgEnum);
  const enums = enumDefinitions
    .map((pgEnum) => ({ name: pgEnum.enumName, values: [...pgEnum.enumValues] }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return { tables, enums };
}

export async function inspectControlPlaneSchema(
  databaseUrl: string
): Promise<ObservedControlPlaneSchema> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const [tableRows, columnRows, constraintRows, indexRows, enumRows] = await Promise.all([
      sql<{ tableName: string }[]>`
        SELECT table_name AS "tableName"
        FROM information_schema.tables
        WHERE table_schema = ${contractSchema}
          AND table_type = 'BASE TABLE'
          AND table_name <> 'atlas_schema_revisions'
        ORDER BY table_name
      `,
      sql<CatalogColumnRow[]>`
        SELECT
          table_name AS "tableName",
          column_name AS "columnName",
          data_type AS "dataType",
          udt_name AS "udtName",
          character_maximum_length::integer AS "characterMaximumLength",
          is_nullable = 'NO' AS "notNull",
          column_default IS NOT NULL AS "hasDefault"
        FROM information_schema.columns
        WHERE table_schema = ${contractSchema}
          AND table_name <> 'atlas_schema_revisions'
        ORDER BY table_name, ordinal_position
      `,
      sql<ObservedControlPlaneSchema['constraints']>`
        SELECT
          relation.relname AS "tableName",
          constraint_record.conname AS name,
          CASE constraint_record.contype
            WHEN 'p' THEN 'primary_key'
            WHEN 'u' THEN 'unique'
            WHEN 'f' THEN 'foreign_key'
          END AS type,
          ARRAY(
            SELECT attribute.attname
            FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key(attnum, position)
            INNER JOIN pg_attribute AS attribute
              ON attribute.attrelid = relation.oid
             AND attribute.attnum = key.attnum
            ORDER BY key.position
          )::text[] AS columns,
          referenced_relation.relname AS "referencedTable",
          CASE
            WHEN referenced_relation.oid IS NULL THEN ARRAY[]::text[]
            ELSE ARRAY(
              SELECT attribute.attname
              FROM unnest(constraint_record.confkey) WITH ORDINALITY AS key(attnum, position)
              INNER JOIN pg_attribute AS attribute
                ON attribute.attrelid = referenced_relation.oid
               AND attribute.attnum = key.attnum
              ORDER BY key.position
            )::text[]
          END AS "referencedColumns",
          CASE constraint_record.confdeltype
            WHEN 'a' THEN 'no_action'
            WHEN 'r' THEN 'restrict'
            WHEN 'c' THEN 'cascade'
            WHEN 'n' THEN 'set_null'
            WHEN 'd' THEN 'set_default'
            ELSE 'no_action'
          END AS "onDelete",
          CASE constraint_record.confupdtype
            WHEN 'a' THEN 'no_action'
            WHEN 'r' THEN 'restrict'
            WHEN 'c' THEN 'cascade'
            WHEN 'n' THEN 'set_null'
            WHEN 'd' THEN 'set_default'
            ELSE 'no_action'
          END AS "onUpdate"
        FROM pg_constraint AS constraint_record
        INNER JOIN pg_class AS relation ON relation.oid = constraint_record.conrelid
        INNER JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        LEFT JOIN pg_class AS referenced_relation
          ON referenced_relation.oid = constraint_record.confrelid
        WHERE namespace.nspname = ${contractSchema}
          AND constraint_record.contype IN ('p', 'u', 'f')
        ORDER BY relation.relname, constraint_record.conname
      `,
      sql<{ tableName: string; name: string }[]>`
        SELECT tablename AS "tableName", indexname AS name
        FROM pg_indexes
        WHERE schemaname = ${contractSchema}
        ORDER BY tablename, indexname
      `,
      sql<{ name: string; values: string[] }[]>`
        SELECT
          pg_type.typname AS name,
          array_agg(pg_enum.enumlabel ORDER BY pg_enum.enumsortorder)::text[] AS values
        FROM pg_type
        INNER JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
        INNER JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = ${contractSchema}
        GROUP BY pg_type.typname
        ORDER BY pg_type.typname
      `,
    ]);

    return {
      tables: tableRows.map((row) => row.tableName),
      columns: columnRows.map((row) => ({
        tableName: row.tableName,
        name: row.columnName,
        sqlType: normalizeObservedSqlType(row),
        notNull: row.notNull,
        hasDefault: row.hasDefault,
      })),
      constraints: constraintRows,
      indexes: indexRows,
      enums: enumRows,
    };
  } finally {
    await sql.end();
  }
}

export function findControlPlaneSchemaContractViolations(
  expected: ExpectedControlPlaneSchemaContract,
  observed: ObservedControlPlaneSchema
): string[] {
  const violations: string[] = [];
  const observedTables = new Set(observed.tables);
  const observedColumns = new Map(
    observed.columns.map((column) => [`${column.tableName}.${column.name}`, column])
  );
  const observedConstraints = new Set(
    observed.constraints.map(
      (constraint) => `${constraint.tableName}:${constraintSignature(constraint)}`
    )
  );
  const observedIndexes = new Set(
    observed.indexes.map((index) => `${index.tableName}.${index.name}`)
  );
  const observedEnums = new Map(observed.enums.map((pgEnum) => [pgEnum.name, pgEnum.values]));

  for (const table of expected.tables) {
    if (!observedTables.has(table.name)) {
      violations.push(`missing table ${contractSchema}.${table.name}`);
      continue;
    }

    for (const column of table.columns) {
      const key = `${table.name}.${column.name}`;
      const actual = observedColumns.get(key);
      if (!actual) {
        violations.push(`missing column ${contractSchema}.${key}`);
        continue;
      }
      if (actual.sqlType !== column.sqlType) {
        violations.push(
          `incompatible type ${contractSchema}.${key}: expected ${column.sqlType}, found ${actual.sqlType}`
        );
      }
      if (actual.notNull !== column.notNull) {
        violations.push(
          `incompatible nullability ${contractSchema}.${key}: expected ${column.notNull ? 'NOT NULL' : 'NULL'}, found ${actual.notNull ? 'NOT NULL' : 'NULL'}`
        );
      }
      if (column.databaseDefaultRequired && !actual.hasDefault) {
        violations.push(`missing database default ${contractSchema}.${key}`);
      }
    }

    for (const constraint of table.constraints) {
      if (!observedConstraints.has(`${table.name}:${constraintSignature(constraint)}`)) {
        violations.push(`missing constraint ${contractSchema}.${table.name}.${constraint.name}`);
      }
    }
    for (const index of table.indexes) {
      if (!observedIndexes.has(`${table.name}.${index}`)) {
        violations.push(`missing index ${contractSchema}.${table.name}.${index}`);
      }
    }
  }

  for (const expectedEnum of expected.enums) {
    const actualValues = observedEnums.get(expectedEnum.name);
    if (!actualValues) {
      violations.push(`missing enum ${contractSchema}.${expectedEnum.name}`);
      continue;
    }
    const missingValues = expectedEnum.values.filter((value) => !actualValues.includes(value));
    if (missingValues.length > 0) {
      violations.push(
        `incompatible enum ${contractSchema}.${expectedEnum.name}: missing required labels [${missingValues.join(', ')}]`
      );
    }
  }

  return violations.sort();
}

export async function assertControlPlaneSchemaContract(databaseUrl: string): Promise<void> {
  const expected = buildExpectedControlPlaneSchemaContract();
  const observed = await inspectControlPlaneSchema(databaseUrl);
  const violations = findControlPlaneSchemaContractViolations(expected, observed);

  if (violations.length > 0) {
    const reported = violations.slice(0, maxReportedViolations);
    const omitted = violations.length - reported.length;
    throw new Error(
      [
        `Control-plane schema contract failed with ${violations.length} violation(s):`,
        ...reported.map((violation) => `- ${violation}`),
        ...(omitted > 0 ? [`- ${omitted} additional violation(s) omitted`] : []),
      ].join('\n')
    );
  }

  console.log(
    `[db:push] verified runtime schema contract (${expected.tables.length} tables, ${expected.enums.length} enums)`
  );
}
