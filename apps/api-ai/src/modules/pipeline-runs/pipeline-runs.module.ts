import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PipelineRunsService } from './pipeline-runs.service';

@Module({
  imports: [DatabaseModule],
  providers: [PipelineRunsService],
  exports: [PipelineRunsService],
})
export class PipelineRunsModule {}