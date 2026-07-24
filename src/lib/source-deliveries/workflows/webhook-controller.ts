import * as restate from '@restatedev/restate-sdk';
import { restateServiceNames } from '@/lib/restate/config';
import type { DurableCommand } from '@/lib/restate/contracts';
import { reconcileRepositoryWebhookController } from '@/lib/source-deliveries/webhook-controller';

export const sourceWebhookController = restate.object({
  name: restateServiceNames.sourceWebhookController,
  handlers: {
    run: async (ctx: restate.ObjectContext, command: DurableCommand) => {
      await ctx.run(
        'reconcile-repository-webhook',
        () => reconcileRepositoryWebhookController(command.aggregateId),
        {
          maxRetryAttempts: 3,
          initialRetryInterval: { seconds: 5 },
          maxRetryInterval: { minutes: 5 },
        }
      );
    },
  },
});
