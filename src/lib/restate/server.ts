import * as restate from '@restatedev/restate-sdk';
import { closeDb } from '@/lib/db';
import { getRestateServicePort } from '@/lib/restate/config';
import { restateServices } from '@/lib/restate/services';
import { startTelemetry, stopTelemetry } from '@/lib/telemetry/instrumentation';

await startTelemetry('juanie-restate-services');
const port = await restate.serve({
  services: restateServices,
  port: getRestateServicePort(),
});

console.log(`[restate-services] listening on ${port}`);

async function shutdown(): Promise<void> {
  await closeDb();
  await stopTelemetry();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
