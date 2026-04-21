-- Create enum type "environmentDeploymentRuntime"
CREATE TYPE "environmentDeploymentRuntime" AS ENUM ('native_k8s', 'argo_rollouts');

-- Modify "environment" table
ALTER TABLE "environment"
ADD COLUMN "deploymentRuntime" "environmentDeploymentRuntime" NOT NULL DEFAULT 'native_k8s';
