import { Injectable } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { UsersRouter } from '../modules/users/users.router';
import { OrganizationsRouter } from '../modules/organizations/organizations.router';
import { ProjectsRouter } from '../modules/projects/projects.router';
import { AuthRouter } from '../modules/auth/auth.router';
import { AiAssistantsRouter } from '../modules/ai-assistants/ai-assistants.router';
import { WorkflowsRouter } from '../modules/workflows/workflows.router';

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly usersRouter: UsersRouter,
    private readonly organizationsRouter: OrganizationsRouter,
    private readonly projectsRouter: ProjectsRouter,
    private readonly authRouter: AuthRouter,
    private readonly aiAssistantsRouter: AiAssistantsRouter,
    private readonly workflowsRouter: WorkflowsRouter,
  ) {}

  public get appRouter() {
    return this.trpc.router({
      // 健康检查端点
      health: this.trpc.publicProcedure.query(() => {
        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        };
      }),

      // 核心模块
      users: this.usersRouter.usersRouter,
      organizations: this.organizationsRouter.organizationsRouter,
      projects: this.projectsRouter.projectsRouter,

      // 认证授权和安全
      auth: this.authRouter.authRouter,

      // AI 和自动化
      aiAssistants: this.aiAssistantsRouter.aiAssistantsRouter,
      workflows: this.workflowsRouter.workflowsRouter,
    });
  }
}

export type AppRouter = TrpcRouter['appRouter'];