import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { AiRecommendationsService } from './ai-recommendations.service';
import { AiRecommendationsRouter } from './ai-recommendations.router';

@Module({
  providers: [AiRecommendationsService, AiRecommendationsRouter, TrpcService],
  exports: [AiRecommendationsService],
})
export class AiRecommendationsModule {}