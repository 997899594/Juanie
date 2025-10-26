import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { RolesService } from './roles.service';
import { z } from 'zod';

@Injectable()
export class RolesRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly rolesService: RolesService,
  ) {}

  public get rolesRouter() {
    return this.trpc.router({
      // TODO: Implement actual role management procedures here
      hello: this.trpc.publicProcedure
        .query(() => {
          return this.rolesService.hello();
        }),
    });
  }
}