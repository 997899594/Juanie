import { Module } from '@nestjs/common'
import { DrizzleModule } from '../../drizzle/drizzle.module'
import { AuthService } from './services/auth.service'
import { SessionService } from './services/session.service'

@Module({
  imports: [DrizzleModule],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
