import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { OAuthFlowsService } from './oauth-flows.service';
import { OAuthFlowsRouter } from './oauth-flows.router';

@Module({
    providers: [OAuthFlowsService, OAuthFlowsRouter, TrpcService],
  exports: [OAuthFlowsService, OAuthFlowsRouter]})
export class OAuthFlowsModule {}