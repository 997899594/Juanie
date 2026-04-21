-- Create enum type "databaseRuntime"
CREATE TYPE "databaseRuntime" AS ENUM (
  'external',
  'shared_postgres',
  'shared_redis',
  'cloudnativepg',
  'native_k8s'
);

-- Modify "database" table
ALTER TABLE "database"
ADD COLUMN "runtime" "databaseRuntime";
