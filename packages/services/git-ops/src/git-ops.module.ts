import { DatabaseModule } from '@juanie/core-database/module'
import { K3sModule } from '@juanie/service-k3s'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GitOpsService } from './git-ops.service'

@Module({
  imports: [DatabaseModule, K3sModule, ConfigModule],
  providers: [GitOpsService],
  exports: [GitOpsService],
})
export class GitOpsModule {}
