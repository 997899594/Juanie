import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { WebhookEventsService } from './webhook-events.service';

@Module({
  imports: [DatabaseModule],
  providers: [WebhookEventsService, TrpcService],
  exports: [WebhookEventsService],
})
export class WebhookEventsModule {}