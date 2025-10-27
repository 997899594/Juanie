import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { IdentityProvidersService } from './identity-providers.service';

@Module({
    providers: [IdentityProvidersService, TrpcService],
  exports: [IdentityProvidersService]})
export class IdentityProvidersModule {}