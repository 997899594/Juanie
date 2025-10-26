import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { OAuthAccountsService } from './oauth-accounts.service';
import { z } from 'zod';

@Injectable()
export class OAuthAccountsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly oauthAccountsService: OAuthAccountsService,
  ) {}

  get oauthAccountsRouter() {
    return this.trpc.router({
      // TODO: Implement actual OAuth account management procedures here
      hello: this.trpc.publicProcedure
        .query(() => {
          return this.oauthAccountsService.hello();
        }),
    });
  }
}