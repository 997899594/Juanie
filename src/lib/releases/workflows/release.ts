import * as restate from '@restatedev/restate-sdk';
import { runReleaseCommand } from '@/lib/queue/release';
import { finalizeDeploymentRollout } from '@/lib/releases/rollout';
import { restateServiceNames } from '@/lib/restate/config';
import type { DurableCommand } from '@/lib/restate/contracts';
import { readDurableCommandString } from '@/lib/restate/payload';

export const releaseWorkflow = restate.object({
  name: restateServiceNames.release,
  handlers: {
    run: async (ctx: restate.ObjectContext, command: DurableCommand) => {
      for (let attempt = 1; ; attempt += 1) {
        const result = await ctx.run(
          `drive-release-${command.commandId}-${attempt}`,
          () =>
            runReleaseCommand({
              releaseId: command.aggregateId,
              traceId: readDurableCommandString(command.payload, 'traceId', command.aggregateId),
            }),
          { maxRetryAttempts: 8 }
        );

        if (!result || !('retryAfterMs' in result) || result.retryAfterMs === undefined) {
          return result;
        }
        await ctx.sleep(result.retryAfterMs, `wait-for-schema-refresh-${attempt}`);
      }
    },
    rollout: async (ctx: restate.ObjectContext, command: DurableCommand) =>
      ctx.run(
        `rollout-${command.commandId}`,
        () =>
          finalizeDeploymentRollout({
            projectId: readDurableCommandString(command.payload, 'projectId'),
            deploymentId: readDurableCommandString(command.payload, 'deploymentId'),
            actorUserId: readDurableCommandString(command.payload, 'actorUserId'),
            commandId: command.commandId,
          }),
        { maxRetryAttempts: 8 }
      ),
  },
});
