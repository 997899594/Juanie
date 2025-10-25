import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from './trpc.service';
import { UsersRouter } from '../modules/users';
import { organizationsRouter } from '../modules/organizations';

@Injectable()
export class TrpcRouter {
  public readonly appRouter;

  constructor(
    private readonly trpc: TrpcService,
    private readonly usersRouter: UsersRouter,
  ) {
    this.appRouter = this.trpc.router({
      // Health check endpoint
      health: this.trpc.publicProcedure
        .input(z.void())
        .output(z.object({ status: z.string(), timestamp: z.string() }))
        .query(() => ({
          status: 'ok',
          timestamp: new Date().toISOString(),
        })),

      // Core foundation modules
      users: this.usersRouter.usersRouter,
      organizations: organizationsRouter,

      // Permission and authentication modules
      // auth: authRouter, // TODO: Implement authentication router

      // Code management modules
      // projects: projectsRouter, // TODO: Implement projects router
      // repositories: repositoriesRouter, // TODO: Implement repositories router

      // Deployment and operations modules
      // deployments: deploymentsRouter, // TODO: Implement deployments router
      // environments: environmentsRouter, // TODO: Implement environments router

      // Event handling modules
      // events: eventsRouter, // TODO: Implement events router

      // AI intelligence modules
      // ai: aiRouter, // TODO: Implement AI router

      // Cost auditing modules
      // costs: costsRouter, // TODO: Implement costs router
    });
  }
}

export type AppRouter = TrpcRouter['appRouter'];