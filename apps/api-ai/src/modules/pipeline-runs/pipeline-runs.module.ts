import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { PipelineRunsService } from './pipeline-runs.service';

@Module({
  imports: [DatabaseModule],
  providers: [PipelineRunsService, TrpcService],
  exports: [PipelineRunsService],
})
export class PipelineRunsModule {}