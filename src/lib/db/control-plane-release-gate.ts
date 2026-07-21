import { runControlPlaneReadModelSmoke } from '@/lib/db/control-plane-read-model-smoke';
import { assertControlPlaneSchemaContract } from '@/lib/db/control-plane-schema-contract';

interface ControlPlaneReleaseGateDependencies {
  assertSchemaContract: (databaseUrl: string) => Promise<void>;
  runReadModelSmoke: () => Promise<void>;
}

const defaultDependencies: ControlPlaneReleaseGateDependencies = {
  assertSchemaContract: assertControlPlaneSchemaContract,
  runReadModelSmoke: runControlPlaneReadModelSmoke,
};

export async function verifyControlPlaneReleaseGate(
  databaseUrl: string,
  dependencies: ControlPlaneReleaseGateDependencies = defaultDependencies
): Promise<void> {
  await dependencies.assertSchemaContract(databaseUrl);
  await dependencies.runReadModelSmoke();
}
