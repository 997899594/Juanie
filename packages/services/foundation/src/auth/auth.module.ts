import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthService } from './auth.service'

/**
 * Auth Module
 *
 * 提供认证服务
 * 设为全局模块，因为被多个业务模块共享使用
 *
 * 注意：OAuthAccountsService 已被 GitConnectionsService 替代
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
