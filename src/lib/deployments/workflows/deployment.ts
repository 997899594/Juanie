import * as restate from '@restatedev/restate-sdk';
import { runDeploymentCommand } from '@/lib/queue/deployment';
import { restateServiceNames } from '@/lib/restate/config';
import type { DurableCommand } from '@/lib/restate/contracts';
import { readDurableCommandString } from '@/lib/restate/payload';

export const deploymentWorkflow = restate.object({
  name: restateServiceNames.deployment,
  handlers: {
    run: async (ctx: restate.ObjectContext, command: DurableCommand) =>
      ctx.run(
        `deployment-${command.commandId}`,
        () =>
          runDeploymentCommand({
            deploymentId: command.aggregateId,
            projectId: readDurableCommandString(command.payload, 'projectId'),
            environmentId: readDurableCommandString(command.payload, 'environmentId'),
            traceId:
              typeof command.payload.traceId === 'string' ? command.payload.traceId : undefined,
          }),
        { maxRetryAttempts: 3 }
      ),
  },
});
