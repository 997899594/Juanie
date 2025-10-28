import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { CodeAnalysisResultsService } from './code-analysis-results.service';
import { CodeAnalysisResultsRouter } from './code-analysis-results.router';

@Module({
  providers: [CodeAnalysisResultsService, CodeAnalysisResultsRouter, TrpcService],
  exports: [CodeAnalysisResultsService, CodeAnalysisResultsRouter]
})
export class CodeAnalysisResultsModule {}