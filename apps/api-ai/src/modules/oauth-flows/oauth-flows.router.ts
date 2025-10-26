import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { OAuthFlowsService } from './oauth-flows.service';
import { z } from 'zod';

@Injectable()
export class OAuthFlowsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly oauthFlowsService: OAuthFlowsService,
  ) {}

  public get oauthFlowsRouter() {
    return this.trpc.router({
      // TODO: Implement actual OAuth flow management procedures here
      hello: this.trpc.publicProcedure
        .query(() => {
          return this.oauthFlowsService.hello();
        }),
    });
  }
}