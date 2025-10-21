import { z } from 'zod';
import { idSchema, paginationSchema, sortSchema, searchSchema } from './common.schema';

// GitLab项目可见性
export const gitlabVisibilitySchema = z.enum(['private', 'internal', 'public']);

// GitLab项目状态
export const gitlabProjectStatusSchema = z.enum(['active', 'archived', 'pending_delete']);

// 创建GitLab项目
export const createGitlabProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  visibility: gitlabVisibilitySchema.default('private'),
  initialize_with_readme: z.boolean().default(true),
  namespace_id: z.number().int().optional(),
  path: z.string().regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid project path').optional(),
  default_branch: z.string().default('main'),
  issues_enabled: z.boolean().default(true),
  merge_requests_enabled: z.boolean().default(true),
  wiki_enabled: z.boolean().default(false),
  snippets_enabled: z.boolean().default(false),
});

// 获取GitLab项目列表
export const listGitlabProjectsSchema = z.object({
  ...paginationSchema.shape,
  ...sortSchema.shape,
  ...searchSchema.shape,
  visibility: gitlabVisibilitySchema.optional(),
  owned: z.boolean().optional(),
  membership: z.boolean().optional(),
  starred: z.boolean().optional(),
  archived: z.boolean().optional(),
  simple: z.boolean().default(false),
  order_by: z.enum(['id', 'name', 'path', 'created_at', 'updated_at', 'last_activity_at']).default('created_at'),
  statistics: z.boolean().default(false),
  with_custom_attributes: z.boolean().default(false),
  with_issues_enabled: z.boolean().optional(),
  with_merge_requests_enabled: z.boolean().optional(),
  min_access_level: z.number().int().min(10).max(50).optional(),
});

// 搜索GitLab项目
export const searchGitlabProjectsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  ...paginationSchema.shape,
  order_by: z.enum(['id', 'name', 'created_at', 'updated_at', 'last_activity_at']).default('created_at'),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

// 获取GitLab项目
export const getGitlabProjectSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  statistics: z.boolean().default(false),
  license: z.boolean().default(false),
  with_custom_attributes: z.boolean().default(false),
});

// 删除GitLab项目
export const deleteGitlabProjectSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
});

// Fork GitLab项目
export const forkGitlabProjectSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  name: z.string().max(100, 'Project name too long').optional(),
  path: z.string().regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid project path').optional(),
  namespace_id: z.number().int().optional(),
  namespace_path: z.string().optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  visibility: gitlabVisibilitySchema.optional(),
});

// 获取当前用户
export const getCurrentUserSchema = z.object({
  with_custom_attributes: z.boolean().default(false),
});

// 获取用户信息
export const getUserSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  with_custom_attributes: z.boolean().default(false),
});

// 获取群组列表
export const listGroupsSchema = z.object({
  ...paginationSchema.shape,
  ...sortSchema.shape,
  ...searchSchema.shape,
  skip_groups: z.array(z.number().int()).optional(),
  all_available: z.boolean().default(false),
  statistics: z.boolean().default(false),
  with_custom_attributes: z.boolean().default(false),
  owned: z.boolean().optional(),
  min_access_level: z.number().int().min(10).max(50).optional(),
  top_level_only: z.boolean().default(false),
});

// 获取群组信息
export const getGroupSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  with_custom_attributes: z.boolean().default(false),
  with_projects: z.boolean().default(true),
});

// GitLab项目响应
export const gitlabProjectResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  path: z.string(),
  description: z.string().nullable(),
  default_branch: z.string(),
  visibility: gitlabVisibilitySchema,
  ssh_url_to_repo: z.string(),
  http_url_to_repo: z.string(),
  web_url: z.string(),
  readme_url: z.string().nullable(),
  tag_list: z.array(z.string()),
  topics: z.array(z.string()),
  owner: z.object({
    id: z.number().int(),
    name: z.string(),
    username: z.string(),
    avatar_url: z.string().nullable(),
  }).nullable(),
  namespace: z.object({
    id: z.number().int(),
    name: z.string(),
    path: z.string(),
    kind: z.string(),
    full_path: z.string(),
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_activity_at: z.string().datetime(),
  star_count: z.number().int(),
  forks_count: z.number().int(),
  archived: z.boolean(),
  issues_enabled: z.boolean(),
  merge_requests_enabled: z.boolean(),
  wiki_enabled: z.boolean(),
  snippets_enabled: z.boolean(),
  container_registry_enabled: z.boolean(),
  service_desk_enabled: z.boolean(),
  can_create_merge_request_in: z.boolean(),
  issues_access_level: z.string(),
  repository_access_level: z.string(),
  merge_requests_access_level: z.string(),
  forking_access_level: z.string(),
  wiki_access_level: z.string(),
  builds_access_level: z.string(),
  snippets_access_level: z.string(),
  pages_access_level: z.string(),
  analytics_access_level: z.string(),
  container_registry_access_level: z.string(),
  security_and_compliance_access_level: z.string(),
  releases_access_level: z.string(),
  environments_access_level: z.string(),
  feature_flags_access_level: z.string(),
  infrastructure_access_level: z.string(),
  monitor_access_level: z.string(),
  model_experiments_access_level: z.string(),
  model_registry_access_level: z.string(),
});

// GitLab用户响应
export const gitlabUserResponseSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  name: z.string(),
  email: z.string().email().nullable(),
  avatar_url: z.string().nullable(),
  web_url: z.string(),
  created_at: z.string().datetime(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  public_email: z.string().email().nullable(),
  skype: z.string().nullable(),
  linkedin: z.string().nullable(),
  twitter: z.string().nullable(),
  discord: z.string().nullable(),
  website_url: z.string().nullable(),
  organization: z.string().nullable(),
  job_title: z.string().nullable(),
  pronouns: z.string().nullable(),
  bot: z.boolean(),
  work_information: z.string().nullable(),
  followers: z.number().int(),
  following: z.number().int(),
  is_followed: z.boolean(),
  local_time: z.string().nullable(),
  last_sign_in_at: z.string().datetime().nullable(),
  confirmed_at: z.string().datetime().nullable(),
  last_activity_on: z.string().date().nullable(),
  color_scheme_id: z.number().int(),
  projects_limit: z.number().int(),
  current_sign_in_at: z.string().datetime().nullable(),
  identities: z.array(z.object({
    provider: z.string(),
    extern_uid: z.string(),
  })),
  can_create_group: z.boolean(),
  can_create_project: z.boolean(),
  two_factor_enabled: z.boolean(),
  external: z.boolean(),
  private_profile: z.boolean(),
  commit_email: z.string().email().nullable(),
});

// GitLab群组响应
export const gitlabGroupResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  path: z.string(),
  description: z.string().nullable(),
  visibility: gitlabVisibilitySchema,
  lfs_enabled: z.boolean(),
  default_branch_protection: z.number().int(),
  avatar_url: z.string().nullable(),
  web_url: z.string(),
  request_access_enabled: z.boolean(),
  repository_storage: z.string(),
  emails_disabled: z.boolean(),
  mentions_disabled: z.boolean(),
  full_name: z.string(),
  full_path: z.string(),
  created_at: z.string().datetime(),
  parent_id: z.number().int().nullable(),
  ldap_cn: z.string().nullable(),
  ldap_access: z.string().nullable(),
  shared_with_groups: z.array(z.any()),
  projects: z.array(gitlabProjectResponseSchema).optional(),
  shared_projects: z.array(gitlabProjectResponseSchema).optional(),
});

// 类型推断
export type GitlabVisibility = z.infer<typeof gitlabVisibilitySchema>;
export type GitlabProjectStatus = z.infer<typeof gitlabProjectStatusSchema>;
export type CreateGitlabProjectInput = z.infer<typeof createGitlabProjectSchema>;
export type ListGitlabProjectsInput = z.infer<typeof listGitlabProjectsSchema>;
export type SearchGitlabProjectsInput = z.infer<typeof searchGitlabProjectsSchema>;
export type GetGitlabProjectInput = z.infer<typeof getGitlabProjectSchema>;
export type DeleteGitlabProjectInput = z.infer<typeof deleteGitlabProjectSchema>;
export type ForkGitlabProjectInput = z.infer<typeof forkGitlabProjectSchema>;
export type GetCurrentUserInput = z.infer<typeof getCurrentUserSchema>;
export type GetUserInput = z.infer<typeof getUserSchema>;
export type ListGroupsInput = z.infer<typeof listGroupsSchema>;
export type GetGroupInput = z.infer<typeof getGroupSchema>;
export type GitlabProjectResponse = z.infer<typeof gitlabProjectResponseSchema>;
export type GitlabUserResponse = z.infer<typeof gitlabUserResponseSchema>;
export type GitlabGroupResponse = z.infer<typeof gitlabGroupResponseSchema>;