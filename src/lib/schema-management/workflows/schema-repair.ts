import * as restate from '@restatedev/restate-sdk';
import { restateServiceNames } from '@/lib/restate/config';
import type { DurableCommand } from '@/lib/restate/contracts';
import { readDurableCommandString } from '@/lib/restate/payload';
import { dispatchSchemaRepairRunCommand } from '@/lib/schema-management/atlas-run';

export const schemaRepairWorkflow = restate.object({
  name: restateServiceNames.schemaRepair,
  handlers: {
    run: async (ctx: restate.ObjectContext, command: DurableCommand) =>
      ctx.run(
        `schema-repair-${command.commandId}`,
        () =>
          dispatchSchemaRepairRunCommand({
            atlasRunId: command.aggregateId,
            projectId: readDurableCommandString(command.payload, 'projectId'),
            namespace: readDurableCommandString(command.payload, 'namespace'),
            jobName: readDurableCommandString(command.payload, 'jobName'),
            userId: typeof command.payload.userId === 'string' ? command.payload.userId : null,
          }),
        { maxRetryAttempts: 8 }
      ),
  },
});
