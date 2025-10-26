import { Module } from '@nestjs/common';
import { AiRecommendationsService } from './ai-recommendations.service';
import { AiRecommendationsRouter } from './ai-recommendations.router';

@Module({
  providers: [AiRecommendationsService, AiRecommendationsRouter],
  exports: [AiRecommendationsService],
})
export class AiRecommendationsModule {}