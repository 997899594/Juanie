import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthService } from './auth.service'
import { OAuthAccountsService } from './oauth-accounts.service'

/**
 * Auth Module
 *
 * 提供认证和 OAuth 账户管理服务
 * 设为全局模块，因为被多个业务模块共享使用
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [AuthService, OAuthAccountsService],
  exports: [AuthService, OAuthAccountsService],
})
export class AuthModule {}
