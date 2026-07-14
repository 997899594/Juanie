import { appendFile } from 'node:fs/promises';
import * as restate from '@restatedev/restate-sdk';

const markerPath = process.env.RESTATE_CRASH_MARKER_PATH;
if (!markerPath) throw new Error('RESTATE_CRASH_MARKER_PATH is required');

const crashRecoveryWorkflow = restate.workflow({
  name: 'CrashRecoveryWorkflow',
  handlers: {
    run: async (ctx: restate.WorkflowContext) => {
      await ctx.run('durable-checkpoint', () => appendFile(markerPath, 'checkpoint\n'));
      await ctx.sleep(3_000);
      await ctx.run('post-restart-effect', () => appendFile(markerPath, 'effect\n'));
      return { completed: true };
    },
  },
});

await restate.serve({
  services: [crashRecoveryWorkflow],
  port: Number.parseInt(process.env.RESTATE_SERVICE_PORT ?? '9081', 10),
});
