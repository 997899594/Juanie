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

@Injectable()
export class TrpcService implements OnModuleInit {
  private appRouter!: ReturnType<typeof createTRPCRouter>;

  constructor(
    private readonly authService: AuthService,
    private readonly gitlabService: GitLabService,
    private readonly documentsService: DocumentsService,
    private readonly projectsService: ProjectsService,
    private readonly environmentsService: EnvironmentsService,
    private readonly deploymentsService: DeploymentsService
  ) {}

  async onModuleInit() {
    this.appRouter = createTRPCRouter({
      auth: createAuthRouter(this.authService),
      documents: createDocumentsRouter(this.documentsService),
      gitlab: createGitLabRouter(this.gitlabService),
      projects: createProjectsRouter(this.projectsService),
      environments: createEnvironmentsRouter(this.environmentsService),
      deployments: createDeploymentsRouter(this.deploymentsService),
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

// 正确的 AppRouter 类型定义
export type AppRouter = ReturnType<
  typeof createTRPCRouter<{
    auth: ReturnType<typeof createAuthRouter>;
    documents: ReturnType<typeof createDocumentsRouter>;
    gitlab: ReturnType<typeof createGitLabRouter>;
    projects: ReturnType<typeof createProjectsRouter>;
    environments: ReturnType<typeof createEnvironmentsRouter>;
    deployments: ReturnType<typeof createDeploymentsRouter>;
  }>
>;
