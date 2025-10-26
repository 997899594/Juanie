import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WebhookEndpointsService } from './webhook-endpoints.service';

@Module({
  imports: [DatabaseModule],
  providers: [WebhookEndpointsService],
  exports: [WebhookEndpointsService],
})
export class WebhookEndpointsModule {}