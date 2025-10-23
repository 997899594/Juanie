// 导出 tRPC 相关类型和服务

// 导出所有路由创建函数的类型
export { createAuthRouter } from "./trpc/routers/auth.router";
export { createDeploymentsRouter } from "./trpc/routers/deployments.router";
export { createDocumentsRouter } from "./trpc/routers/documents.router";
export { createEnvironmentsRouter } from "./trpc/routers/environments.router";
export { createGitLabRouter } from "./trpc/routers/gitlab.router";
export { createProjectsRouter } from "./trpc/routers/projects.router";
export type { AppRouter } from "./trpc/trpc.service";
export { TrpcService } from "./trpc/trpc.service";
