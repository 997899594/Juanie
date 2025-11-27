import { DatabaseModule } from '@juanie/core/database'
import { AuthModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GitProvidersModule } from '../gitops/git-providers/git-providers.module'
import { RepositoriesService } from './repositories.service'

@Module({
  imports: [ConfigModule, DatabaseModule, GitProvidersModule, AuthModule],
  providers: [RepositoriesService],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
