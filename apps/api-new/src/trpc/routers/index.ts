// 装饰器路由器导出
export { AuthRouter } from './auth.decorator.router';
export { GitLabRouter } from './gitlab.decorator.router';
export { DocumentsRouter } from './documents.decorator.router';

// 传统函数式路由器导出（向后兼容）
export { createAuthRouter } from './auth.router';
export { createGitLabRouter } from './gitlab.router';

// 路由器类型导出
export type { AuthRouter as AuthRouterType } from './auth.decorator.router';
export type { GitLabRouter as GitLabRouterType } from './gitlab.decorator.router';
export type { DocumentsRouter as DocumentsRouterType } from './documents.decorator.router';