import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { IdentityProvidersService } from './identity-providers.service';
import { z } from 'zod';

@Injectable()
export class IdentityProvidersRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly identityProvidersService: IdentityProvidersService,
  ) {}

  public get identityProvidersRouter() {
    return this.trpc.router({
      // TODO: Implement actual identity provider management procedures here
      hello: this.trpc.publicProcedure
        .query(() => {
          return this.identityProvidersService.hello();
        }),
    });
  }
}