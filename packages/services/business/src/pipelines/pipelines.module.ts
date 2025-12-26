import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { PipelinesService } from './pipelines.service'

@Module({
  imports: [BullModule.registerQueue({ name: 'pipeline' })],
  providers: [PipelinesService],
  exports: [PipelinesService],
})
export class PipelinesModule {}
