import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthService } from './auth.service'
import { OAuthAccountsService } from './oauth-accounts.service'

@Module({
  imports: [ConfigModule],
  providers: [AuthService, OAuthAccountsService],
  exports: [AuthService, OAuthAccountsService],
})
export class AuthModule {}
