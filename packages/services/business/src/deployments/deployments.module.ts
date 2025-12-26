import { FluxModule } from '@juanie/core/flux'
import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { DeploymentsService } from './deployments.service'

@Module({
  imports: [FluxModule, BullModule.registerQueue({ name: 'deployment' })],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
