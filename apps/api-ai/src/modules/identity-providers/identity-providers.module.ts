import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { IdentityProvidersService } from './identity-providers.service';
import { IdentityProvidersRouter } from './identity-providers.router';

@Module({
  providers: [IdentityProvidersService, IdentityProvidersRouter, TrpcService],
  exports: [IdentityProvidersService, IdentityProvidersRouter],
})
export class IdentityProvidersModule {}