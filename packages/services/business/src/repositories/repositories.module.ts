import { DatabaseModule } from '@juanie/core/database'
import { AuthModule, GitConnectionsModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GitProvidersModule } from '../gitops/git-providers/git-providers.module'
import { RepositoriesService } from './repositories.service'

@Module({
  imports: [ConfigModule, DatabaseModule, GitProvidersModule, AuthModule, GitConnectionsModule],
  providers: [RepositoriesService],
  exports: [
    RepositoriesService,
    GitConnectionsModule, // 重新导出，让依赖 RepositoriesModule 的模块也能使用 GitConnectionsService
  ],
})
export class RepositoriesModule {}
