# Control-Plane Schema Convergence Design

## Requirements

- Repair the production schema without issuing untracked SQL or rewriting migration history again.
- Support both known `20260714120000` outcomes with one append-only migration.
- Fail a Helm pre-upgrade before Web rollout when the target runtime requires absent or incompatible
  database objects.
- Generate the compatibility contract from the canonical Drizzle schema rather than duplicate it.
- Validate the real migration-run query graph that caused project overview rendering to fail.
- Permit extra expand-compatible objects until explicit contract promotion.
- Keep the release-side operation automatic and configuration-free.

## Architecture

The new reconciliation migration uses PostgreSQL catalog guards to create the missing enum, table,
column, foreign key, and indexes. Every branch is convergent: the original production schema receives
the objects, while databases that already contain them perform a no-op and still record the new
revision.

After Atlas applies expand migrations, the schema-runner builds an expected contract from every
Drizzle PostgreSQL table and enum. It reads the production catalog through the existing control-plane
connection and compares the expected subset with actual tables, columns, types, nullability, required
database defaults, enum labels, indexes, and structural constraints. Unexpected extra objects are
accepted because the independent contract chain may intentionally retain N-1 structures.

The same pre-upgrade process then runs bounded, read-only Drizzle queries for the project overview
read models. These use `limit 1` and select no user-specific data for output; their purpose is to make
PostgreSQL compile and execute the same relation graph used by the Web application. Any mismatch
terminates the Helm hook, and `--atomic` keeps the previous application revision serving traffic.
The independently promoted contract chain runs the same gate after destructive changes so it cannot
invalidate the active runtime after the N-1 rollback window closes.

## Failure Model

- Reconciliation DDL failure: Atlas leaves the revision failed and Helm does not roll out.
- Missing or incompatible required object: schema contract reports bounded object identifiers and
  fails the pre-upgrade Job.
- Query graph failure: read-model smoke reports the named read model without exposing row data.
- Extra legacy object: accepted until explicit contract promotion.
- Contract inspection failure: fail closed; a release without a trustworthy compatibility verdict
  cannot proceed.

## Non-Functional Requirements

- Availability: the previous Helm revision remains active on any gate failure.
- Security: all gates are read-only after tracked migration execution and do not log credentials or
  row contents.
- Performance: catalog checks are one-shot and bounded; smoke queries use `limit 1`.
- Maintainability: Drizzle schema metadata is the single runtime contract source.
- Observability: successful gates log counts; failures identify only schema/read-model names.
