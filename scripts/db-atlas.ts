import { executeControlPlaneAtlasCommand } from '../src/lib/db/control-plane-atlas';

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  await executeControlPlaneAtlasCommand(command, arg);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
