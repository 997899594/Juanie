import { DatabaseModule } from '@juanie/core-database/module'
import { K3sModule } from '@juanie/service-k3s'
import { Module } from '@nestjs/common'
import { DeploymentsService } from './deployments.service'

@Module({
  imports: [DatabaseModule, K3sModule],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
