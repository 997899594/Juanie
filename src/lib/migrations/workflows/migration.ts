import * as restate from '@restatedev/restate-sdk';
import { runMigrationCommand } from '@/lib/queue/migration';
import { restateServiceNames } from '@/lib/restate/config';
import type { DurableCommand } from '@/lib/restate/contracts';

export const migrationWorkflow = restate.object({
  name: restateServiceNames.migration,
  handlers: {
    run: async (ctx: restate.ObjectContext, command: DurableCommand) =>
      ctx.run(
        `migration-${command.commandId}`,
        () =>
          runMigrationCommand({
            runId: command.aggregateId,
            allowApprovalBypass: command.payload.allowApprovalBypass === true,
            traceId:
              typeof command.payload.traceId === 'string' ? command.payload.traceId : undefined,
          }),
        { maxRetryAttempts: 8 }
      ),
  },
});
