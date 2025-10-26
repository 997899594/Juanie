import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { RepositoriesService } from './repositories.service';
import { z } from 'zod';

@Injectable()
export class RepositoriesRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly repositoriesService: RepositoriesService,
  ) {}

  public get repositoriesRouter() {
    return this.trpc.router({
      // TODO: Implement actual repository management procedures here
      hello: this.trpc.publicProcedure
        .query(() => {
          return this.repositoriesService.hello();
        }),
    });
  }
}