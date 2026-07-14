import * as restate from '@restatedev/restate-sdk';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { setEnvironmentRuntimeState } from '@/lib/environments/runtime-control';
import { restateServiceNames } from '@/lib/restate/config';
import type { DurableCommand } from '@/lib/restate/contracts';

export const environmentRuntimeWorkflow = restate.object({
  name: restateServiceNames.environmentRuntime,
  handlers: {
    run: async (ctx: restate.ObjectContext, command: DurableCommand) =>
      ctx.run(
        `runtime-${command.commandId}`,
        async () => {
          if (command.payload.action !== 'wake') {
            throw new restate.TerminalError(
              `Unsupported environment runtime action: ${String(command.payload.action)}`
            );
          }
          const environment = await db.query.environments.findFirst({
            where: eq(environments.id, command.aggregateId),
            with: { project: true },
          });
          if (!environment?.project) {
            throw new restate.TerminalError(`Environment ${command.aggregateId} not found`);
          }
          return setEnvironmentRuntimeState({
            project: environment.project,
            environment,
            action: 'wake',
            waitForReadyMs: 120_000,
          });
        },
        { maxRetryAttempts: 8 }
      ),
  },
});
