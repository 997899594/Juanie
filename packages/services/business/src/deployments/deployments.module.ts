import { Module } from '@nestjs/common'
import { FluxModule } from '../gitops/flux/flux.module'
import { GitOpsModule } from '../gitops/git-ops/git-ops.module'
import { DeploymentsService } from './deployments.service'

@Module({
  imports: [GitOpsModule, FluxModule],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
