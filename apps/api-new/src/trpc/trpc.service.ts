import { Injectable, type OnModuleInit } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { DeploymentsService } from "../deployments/deployments.service";
import { DocumentsService } from "../documents/documents.service";
import { EnvironmentsService } from "../environments/environments.service";
import { GitLabService } from "../gitlab/gitlab.service";
import { ProjectsService } from "../projects/projects.service";
import { createAuthRouter } from "./routers/auth.router";
import { createDeploymentsRouter } from "./routers/deployments.router";
import { createDocumentsRouter } from "./routers/documents.router";
import { createEnvironmentsRouter } from "./routers/environments.router";
import { createGitLabRouter } from "./routers/gitlab.router";
import { createProjectsRouter } from "./routers/projects.router";
import { createTRPCRouter } from "./trpc";

// 先定义路由器创建函数，用于类型推断
function createAppRouter(services: {
  authService: AuthService;
  gitlabService: GitLabService;
  documentsService: DocumentsService;
  projectsService: ProjectsService;
  environmentsService: EnvironmentsService;
  deploymentsService: DeploymentsService;
}) {
  return createTRPCRouter({
    auth: createAuthRouter(services.authService),
    documents: createDocumentsRouter(services.documentsService),
    gitlab: createGitLabRouter(services.gitlabService),
    projects: createProjectsRouter(services.projectsService),
    environments: createEnvironmentsRouter(services.environmentsService),
    deployments: createDeploymentsRouter(services.deploymentsService),
  });
}

// 导出 AppRouter 类型 - 这是 tRPC 的标准做法
export type AppRouter = ReturnType<typeof createAppRouter>;

@Injectable()
export class TrpcService implements OnModuleInit {
  private appRouter!: AppRouter;

  constructor(
    private readonly authService: AuthService,
    private readonly gitlabService: GitLabService,
    private readonly documentsService: DocumentsService,
    private readonly projectsService: ProjectsService,
    private readonly environmentsService: EnvironmentsService,
    private readonly deploymentsService: DeploymentsService
  ) {}

  async onModuleInit() {
    this.appRouter = createAppRouter({
      authService: this.authService,
      gitlabService: this.gitlabService,
      documentsService: this.documentsService,
      projectsService: this.projectsService,
      environmentsService: this.environmentsService,
      deploymentsService: this.deploymentsService,
    });
  }

  get router() {
    return this.appRouter;
  }

  getAppRouter() {
    return this.appRouter;
  }

  getStats() {
    return {
      routers: [
        "auth",
        "documents",
        "gitlab",
        "projects",
        "environments",
        "deployments",
      ],
      totalRouters: 6,
    };
  }
}
