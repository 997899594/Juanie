import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { PipelineRunsService } from './pipeline-runs.service';
import { PipelineRunsRouter } from './pipeline-runs.router';

@Module({
  imports: [DatabaseModule],
  providers: [PipelineRunsService, PipelineRunsRouter, TrpcService],
  exports: [PipelineRunsService, PipelineRunsRouter],
})
export class PipelineRunsModule {}