import { Module } from '@nestjs/common';
import { TrpcModule } from '../../trpc/trpc.module';
import { OAuthFlowsService } from './oauth-flows.service';
import { OAuthFlowsRouter } from './oauth-flows.router';

@Module({
  imports: [TrpcModule],
  providers: [OAuthFlowsService, OAuthFlowsRouter],
  exports: [OAuthFlowsService, OAuthFlowsRouter],
})
export class OAuthFlowsModule {}