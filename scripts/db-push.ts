import { applyControlPlaneMigrations } from '../src/lib/db/control-plane-atlas';

applyControlPlaneMigrations().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
