import { Injectable, OnModuleInit } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { DocumentsService } from "../documents/documents.service";
import { GitLabService } from "../gitlab/gitlab.service";
import { createAuthRouter } from "./routers/auth.router";
import { createDocumentsRouter } from "./routers/documents.router";
import { createGitLabRouter } from "./routers/gitlab.router";
import { createTRPCRouter } from "./trpc";

@Injectable()
export class TrpcService implements OnModuleInit {
  private appRouter: ReturnType<typeof createTRPCRouter>;

  constructor(
    private readonly authService: AuthService,
    private readonly gitlabService: GitLabService,
    private readonly documentsService: DocumentsService
  ) {}

  async onModuleInit() {
    this.appRouter = createTRPCRouter({
      auth: createAuthRouter(this.authService),
      gitlab: createGitLabRouter(this.gitlabService),
      documents: createDocumentsRouter(this.documentsService),
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
      routers: ["auth", "gitlab", "documents"],
      totalRouters: 3,
    };
  }
}

// 正确的 AppRouter 类型定义
export type AppRouter = ReturnType<
  typeof createTRPCRouter<{
    auth: ReturnType<typeof createAuthRouter>;
    gitlab: ReturnType<typeof createGitLabRouter>;
    documents: ReturnType<typeof createDocumentsRouter>;
  }>
>;
