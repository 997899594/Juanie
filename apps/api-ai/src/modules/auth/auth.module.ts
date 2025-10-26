import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TrpcModule } from '../../trpc/trpc.module';

@Module({
  imports: [TrpcModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}