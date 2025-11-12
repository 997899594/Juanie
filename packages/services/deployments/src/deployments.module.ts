import { DatabaseModule } from '@juanie/core-database/module'
import { GitOpsModule } from '@juanie/service-git-ops'
import { K3sModule } from '@juanie/service-k3s'
import { Module } from '@nestjs/common'
import { DeploymentsService } from './deployments.service'

@Module({
  imports: [DatabaseModule, K3sModule, GitOpsModule],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
