-- juanie:history-reconciliation-through 20260717090000
-- Attach the historical standalone unique index as the canonical table constraint.
DO $$
DECLARE
  database_attribute_number smallint;
  named_constraint pg_constraint%ROWTYPE;
  named_relation record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "environmentSchemaState"
    GROUP BY "databaseId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'environment schema state contains duplicate database identities';
  END IF;

  SELECT attnum
  INTO STRICT database_attribute_number
  FROM pg_attribute
  WHERE attrelid = '"environmentSchemaState"'::regclass
    AND attname = 'databaseId'
    AND NOT attisdropped;

  SELECT *
  INTO named_constraint
  FROM pg_constraint
  WHERE conrelid = '"environmentSchemaState"'::regclass
    AND conname = 'environmentSchemaState_database_unique';

  IF FOUND THEN
    IF named_constraint.contype <> 'u'
      OR named_constraint.conkey <> ARRAY[database_attribute_number]::smallint[]
    THEN
      RAISE EXCEPTION
        'environmentSchemaState_database_unique exists with an incompatible constraint definition';
    END IF;
    RETURN;
  END IF;

  SELECT
    relation.oid,
    relation.relkind,
    index.indrelid,
    index.indisunique,
    index.indisvalid,
    index.indisready,
    index.indnkeyatts,
    index.indnatts,
    index.indkey,
    index.indexprs,
    index.indpred
  INTO named_relation
  FROM pg_class AS relation
  INNER JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  LEFT JOIN pg_index AS index ON index.indexrelid = relation.oid
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'environmentSchemaState_database_unique';

  IF FOUND THEN
    IF named_relation.relkind <> 'i'
      OR named_relation.indrelid <> '"environmentSchemaState"'::regclass
      OR NOT named_relation.indisunique
      OR NOT named_relation.indisvalid
      OR NOT named_relation.indisready
      OR named_relation.indnkeyatts <> 1
      OR named_relation.indnatts <> 1
      OR named_relation.indkey[0] <> database_attribute_number
      OR named_relation.indexprs IS NOT NULL
      OR named_relation.indpred IS NOT NULL
    THEN
      RAISE EXCEPTION
        'environmentSchemaState_database_unique exists with an incompatible index definition';
    END IF;

    ALTER TABLE "environmentSchemaState"
      ADD CONSTRAINT "environmentSchemaState_database_unique"
      UNIQUE USING INDEX "environmentSchemaState_database_unique";
    RETURN;
  END IF;

  ALTER TABLE "environmentSchemaState"
    ADD CONSTRAINT "environmentSchemaState_database_unique" UNIQUE ("databaseId");
END
$$;
