import * as restate from '@restatedev/restate-sdk';
import { restateServiceNames } from '@/lib/restate/config';
import type { DurableCommand } from '@/lib/restate/contracts';
import {
  beginSourceDeliveryDispatch,
  completeSourceDeliveryDispatch,
  dispatchAcceptedSourceDelivery,
  failSourceDeliveryDispatch,
} from '@/lib/source-deliveries/service';

export const sourceDeliveryWorkflow = restate.object({
  name: restateServiceNames.sourceDelivery,
  handlers: {
    run: async (ctx: restate.ObjectContext, command: DurableCommand) => {
      const delivery = await ctx.run('begin-source-delivery-dispatch', () =>
        beginSourceDeliveryDispatch(command.aggregateId)
      );
      if (delivery.status === 'dispatched') return;

      try {
        await ctx.run(
          'dispatch-application-delivery',
          () => dispatchAcceptedSourceDelivery(delivery),
          {
            maxRetryAttempts: 8,
            initialRetryInterval: { seconds: 2 },
            maxRetryInterval: { minutes: 2 },
          }
        );
        await ctx.run('complete-source-delivery-dispatch', () =>
          completeSourceDeliveryDispatch(command.aggregateId)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await ctx.run('fail-source-delivery-dispatch', () =>
          failSourceDeliveryDispatch(command.aggregateId, message)
        );
        throw new restate.TerminalError(message);
      }
    },
  },
});
