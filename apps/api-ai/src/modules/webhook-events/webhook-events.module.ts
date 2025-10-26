import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WebhookEventsService } from './webhook-events.service';

@Module({
  imports: [DatabaseModule],
  providers: [WebhookEventsService],
  exports: [WebhookEventsService],
})
export class WebhookEventsModule {}