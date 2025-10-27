import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { OAuthAccountsService } from './oauth-accounts.service';
import { OAuthAccountsRouter } from './oauth-accounts.router';

@Module({
    providers: [OAuthAccountsService, OAuthAccountsRouter, TrpcService],
  exports: [OAuthAccountsService, OAuthAccountsRouter]})
export class OAuthAccountsModule {}