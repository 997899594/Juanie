import { DatabaseModule } from '@juanie/core/database'
import { K8sModule } from '@juanie/core/k8s'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GitConnectionsService } from './git-connections.service'

@Module({
  imports: [DatabaseModule, K8sModule, ConfigModule],
  providers: [GitConnectionsService],
  exports: [GitConnectionsService],
})
export class GitConnectionsModule {}
