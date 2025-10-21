// 通用schema
export * from './common.schema';

// 认证相关schema
export * from './auth.schema';

// 文档相关schema
export * from './document.schema';

// GitLab相关schema
export * from './gitlab.schema';

// 重新导出常用的schema组合
import {
  paginationSchema,
  sortSchema,
  searchSchema,
  successResponseSchema,
  errorResponseSchema,
  paginatedResponseSchema,
} from './common.schema';

import {
  createAuthUrlSchema,
  oauthCallbackSchema,
  userResponseSchema,
  sessionResponseSchema,
} from './auth.schema';

import {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsSchema,
  documentResponseSchema,
} from './document.schema';

import {
  createGitlabProjectSchema,
  listGitlabProjectsSchema,
  gitlabProjectResponseSchema,
  gitlabUserResponseSchema,
} from './gitlab.schema';

// 常用的组合schema
export const commonQuerySchema = paginationSchema.merge(sortSchema).merge(searchSchema);

// 常用的响应schema
export const commonResponseSchemas = {
  success: successResponseSchema,
  error: errorResponseSchema,
  paginated: paginatedResponseSchema,
};

// 认证相关的常用schema
export const authSchemas = {
  createAuthUrl: createAuthUrlSchema,
  oauthCallback: oauthCallbackSchema,
  userResponse: userResponseSchema,
  sessionResponse: sessionResponseSchema,
};

// 文档相关的常用schema
export const documentSchemas = {
  create: createDocumentSchema,
  update: updateDocumentSchema,
  list: listDocumentsSchema,
  response: documentResponseSchema,
};

// GitLab相关的常用schema
export const gitlabSchemas = {
  createProject: createGitlabProjectSchema,
  listProjects: listGitlabProjectsSchema,
  projectResponse: gitlabProjectResponseSchema,
  userResponse: gitlabUserResponseSchema,
};