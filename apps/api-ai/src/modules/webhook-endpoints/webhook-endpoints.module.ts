import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { WebhookEndpointsService } from './webhook-endpoints.service';

@Module({
  imports: [DatabaseModule],
  providers: [WebhookEndpointsService, TrpcService],
  exports: [WebhookEndpointsService],
})
export class WebhookEndpointsModule {}