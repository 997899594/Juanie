import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { EnvironmentsService } from './environments.service';
import { z } from 'zod';

@Injectable()
export class EnvironmentsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly environmentsService: EnvironmentsService,
  ) {}

  public get environmentsRouter() {
    return this.trpc.router({
      // Example public procedure
      hello: this.trpc.publicProcedure
        .input(z.object({ name: z.string().optional() }))
        .query(({ input }) => {
          return `Hello ${input?.name ?? 'world'}`;
        }),

      // TODO: Implement actual environments management procedures here
    });
  }
}