import { DatabaseModule } from '@juanie/core/database'
import { GitOpsModule } from '../gitops/git-ops/git-ops.module'
import { K3sModule } from '../gitops/k3s/k3s.module'
import { Module } from '@nestjs/common'
import { DeploymentsService } from './deployments.service'

@Module({
  imports: [DatabaseModule, K3sModule, GitOpsModule],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
