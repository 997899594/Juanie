import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { AuthService } from './auth.service';

@Module({
    providers: [AuthService, TrpcService],
  exports: [AuthService]})
export class AuthModule {}