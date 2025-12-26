import { AuthModule, GitConnectionsModule, GitProvidersModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { RepositoriesService } from './repositories.service'

@Module({
  imports: [ConfigModule, GitProvidersModule, AuthModule, GitConnectionsModule],
  providers: [RepositoriesService],
  exports: [
    RepositoriesService,
    GitConnectionsModule, // 重新导出，让依赖 RepositoriesModule 的模块也能使用 GitConnectionsService
  ],
})
export class RepositoriesModule {}
