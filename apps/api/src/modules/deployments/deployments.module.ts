import { Module } from '@nestjs/common'
import { DeploymentsRouter } from './deployments.router'
import { DeploymentsService } from './deployments.service'

@Module({
  providers: [DeploymentsService, DeploymentsRouter],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
