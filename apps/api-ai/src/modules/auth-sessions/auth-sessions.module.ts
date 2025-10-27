import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { AuthSessionsService } from './auth-sessions.service';

@Module({
    providers: [AuthSessionsService, TrpcService],
  exports: [AuthSessionsService]})
export class AuthSessionsModule {}