import * as restate from '@restatedev/restate-sdk';
import { restateServiceNames } from '@/lib/restate/config';
import type { DurableCommand } from '@/lib/restate/contracts';
import {
  beginSourceDeliveryDispatch,
  completeSourceDeliveryDispatch,
  dispatchAcceptedSourceDelivery,
} from '@/lib/source-deliveries/service';

export const sourceDeliveryWorkflow = restate.object({
  name: restateServiceNames.sourceDelivery,
  handlers: {
    run: async (ctx: restate.ObjectContext, command: DurableCommand) => {
      const delivery = await ctx.run('begin-source-delivery-dispatch', () =>
        beginSourceDeliveryDispatch(command.aggregateId)
      );
      if (delivery.status === 'dispatched') return;

      await ctx.run(
        'dispatch-application-delivery',
        () => dispatchAcceptedSourceDelivery(delivery),
        {
          initialRetryInterval: { seconds: 2 },
          maxRetryInterval: { minutes: 15 },
        }
      );
      await ctx.run('complete-source-delivery-dispatch', () =>
        completeSourceDeliveryDispatch(command.aggregateId)
      );
    },
  },
});
