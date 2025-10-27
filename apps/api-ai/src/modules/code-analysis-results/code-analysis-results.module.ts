import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { CodeAnalysisResultsService } from './code-analysis-results.service';

@Module({
    providers: [CodeAnalysisResultsService, TrpcService],
  exports: [CodeAnalysisResultsService]})
export class CodeAnalysisResultsModule {}