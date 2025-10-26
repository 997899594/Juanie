import { Module } from '@nestjs/common';
import { TrpcModule } from '../../trpc/trpc.module';
import { IdentityProvidersService } from './identity-providers.service';

@Module({
  imports: [TrpcModule],
  providers: [IdentityProvidersService],
  exports: [IdentityProvidersService],
})
export class IdentityProvidersModule {}