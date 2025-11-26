import { DatabaseModule } from '@juanie/core/database'
import { FoundationModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { K3sModule } from '../k3s/k3s.module'
import { GitAuthService } from './git-auth.service'
import { KnownHostsService } from './known-hosts.service'

@Module({
  imports: [ConfigModule, DatabaseModule, K3sModule, FoundationModule],
  providers: [GitAuthService, KnownHostsService],
  exports: [GitAuthService, KnownHostsService],
})
export class GitAuthModule {}
