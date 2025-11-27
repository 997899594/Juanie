import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GitProviderService } from './git-provider.service'

/**
 * Git Providers Module
 *
 * 提供 GitHub 和 GitLab API 的统一封装
 * 设为全局模块，因为被多个模块共享使用
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [GitProviderService],
  exports: [GitProviderService],
})
export class GitProvidersModule {}
