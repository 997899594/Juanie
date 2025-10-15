import { Module } from '@nestjs/common'
import { ConfigModule } from '../../core/config/nestjs'
import { DrizzleModule } from '../../drizzle/drizzle.module' // 更新引用
import { AuthService } from './services/auth.service'
import { SessionService } from './services/session.service'

@Module({
  imports: [
    ConfigModule, // 导入我们自定义的 ConfigModule
    DrizzleModule,
  ],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
