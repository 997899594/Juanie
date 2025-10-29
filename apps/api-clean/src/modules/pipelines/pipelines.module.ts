import { Module } from '@nestjs/common'
import { QueueModule } from '@/modules/queue/queue.module'
import { PipelineWorker } from '@/modules/queue/workers/pipeline.worker'
import { PipelinesRouter } from './pipelines.router'
import { PipelinesService } from './pipelines.service'

@Module({
  imports: [QueueModule],
  providers: [PipelinesService, PipelinesRouter, PipelineWorker],
  exports: [PipelinesService, PipelinesRouter],
})
export class PipelinesModule {}
