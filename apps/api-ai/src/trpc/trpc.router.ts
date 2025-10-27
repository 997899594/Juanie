import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from './trpc.service';
import { ProjectsRouter } from '../modules/projects/projects.router';

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly projectsRouter: ProjectsRouter,
  ) {}

  get appRouter() {
    return this.trpc.router({
      // 健康检查
      health: this.trpc.router({
        check: this.trpc.publicProcedure
          .input(z.void())
          .query(() => ({
            status: 'ok',
            timestamp: new Date().toISOString(),
          })),
      }),

      // 示例路由
      hello: this.trpc.publicProcedure
        .input(z.object({ name: z.string().optional() }))
        .query(({ input }) => `Hello ${input.name || 'World'}!`),

      // 业务模块
      projects: this.projectsRouter.projectsRouter,
    });
  }
}

export type AppRouter = TrpcRouter['appRouter'];
