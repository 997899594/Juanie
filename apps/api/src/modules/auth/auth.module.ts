import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from '../database/database.module'
import { AuthService } from './services/auth.service'

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
