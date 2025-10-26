import { Module } from '@nestjs/common';
import { TrpcModule } from '../../trpc/trpc.module';
import { OAuthAccountsService } from './oauth-accounts.service';
import { OAuthAccountsRouter } from './oauth-accounts.router';

@Module({
  imports: [TrpcModule],
  providers: [OAuthAccountsService, OAuthAccountsRouter],
  exports: [OAuthAccountsService, OAuthAccountsRouter],
})
export class OAuthAccountsModule {}