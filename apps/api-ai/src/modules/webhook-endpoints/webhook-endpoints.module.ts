import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import { WebhookEndpointsRouter } from './webhook-endpoints.router';

@Module({
  imports: [DatabaseModule],
  providers: [WebhookEndpointsService, WebhookEndpointsRouter, TrpcService],
  exports: [WebhookEndpointsService, WebhookEndpointsRouter],
})
export class WebhookEndpointsModule {}