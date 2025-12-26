import { DatabaseModule } from '@juanie/core/database'
import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { EnvironmentsService } from './environments.service'

@Module({
  imports: [DatabaseModule, BullModule.registerQueue({ name: 'deployment' })],
  providers: [EnvironmentsService],
  exports: [EnvironmentsService],
})
export class EnvironmentsModule {}
