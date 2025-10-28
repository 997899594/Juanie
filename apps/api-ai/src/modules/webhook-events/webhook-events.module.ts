import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { WebhookEventsService } from './webhook-events.service';
import { WebhookEventsRouter } from './webhook-events.router';

@Module({
  imports: [DatabaseModule],
  providers: [WebhookEventsService, WebhookEventsRouter, TrpcService],
  exports: [WebhookEventsService, WebhookEventsRouter],
})
export class WebhookEventsModule {}