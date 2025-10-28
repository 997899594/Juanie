import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { AuthService } from './auth.service';
import { AuthRouter } from './auth.router';

@Module({
  providers: [AuthService, AuthRouter, TrpcService],
  exports: [AuthService, AuthRouter]
})
export class AuthModule {}