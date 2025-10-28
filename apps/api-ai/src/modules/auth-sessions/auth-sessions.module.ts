import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { AuthSessionsService } from './auth-sessions.service';
import { AuthSessionsRouter } from './auth-sessions.router';

@Module({
  providers: [AuthSessionsService, AuthSessionsRouter, TrpcService],
  exports: [AuthSessionsService, AuthSessionsRouter]
})
export class AuthSessionsModule {}