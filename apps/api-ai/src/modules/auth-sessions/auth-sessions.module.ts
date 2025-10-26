import { Module } from '@nestjs/common';
import { TrpcModule } from '../../trpc/trpc.module';
import { AuthSessionsService } from './auth-sessions.service';

@Module({
  imports: [TrpcModule],
  providers: [AuthSessionsService],
  exports: [AuthSessionsService],
})
export class AuthSessionsModule {}