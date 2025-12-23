import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { GitConnectionsModule } from '../git-connections/git-connections.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuthService } from './auth.service'

/**
 * Auth Module
 *
 * 提供认证服务
 * 设为全局模块，因为被多个业务模块共享使用
 */
@Global()
@Module({
  imports: [ConfigModule, GitConnectionsModule, SessionsModule, AuditLogsModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
