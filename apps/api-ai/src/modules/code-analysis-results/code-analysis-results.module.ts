import { Module } from '@nestjs/common';
import { TrpcModule } from '../../trpc/trpc.module';
import { CodeAnalysisResultsService } from './code-analysis-results.service';

@Module({
  imports: [TrpcModule],
  providers: [CodeAnalysisResultsService],
  exports: [CodeAnalysisResultsService],
})
export class CodeAnalysisResultsModule {}