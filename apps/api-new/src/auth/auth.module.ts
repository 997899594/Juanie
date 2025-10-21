import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionCacheService } from './session-cache.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  providers: [AuthService, SessionCacheService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}