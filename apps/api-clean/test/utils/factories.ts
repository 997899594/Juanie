/**
 * 测试数据工厂
 * 用于生成测试数据
 */

import { randomUUID } from 'crypto'

/**
 * 用户工厂
 */
export const userFactory = {
  build: (overrides: Partial<any> = {}) => ({
    id: randomUUID(),
    email: `test-${Date.now()}@example.com`,
    username: `testuser${Date.now()}`,
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    preferences: {
      language: 'en' as const,
      theme: 'system' as const,
      notifications: {
        email: true,
        inApp: true,
      },
    },
    lastLoginAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
}

/**
 * 组织工厂
 */
export const organizationFactory = {
  build: (overrides: Partial<any> = {}) => ({
    id: randomUUID(),
    name: `Test Org ${Date.now()}`,
    slug: `test-org-${Date.now()}`,
    displayName: 'Test Organization',
    logoUrl: null,
    quotas: {
      maxProjects: 10,
      maxUsers: 50,
      maxStorageGb: 100,
    },
    billing: {
      plan: 'free' as const,
    },
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
}

/**
 * 团队工厂
 */
export const teamFactory = {
  build: (organizationId: string, overrides: Partial<any> = {}) => ({
    id: randomUUID(),
    organizationId,
    name: `Test Team ${Date.now()}`,
    slug: `test-team-${Date.now()}`,
    description: 'Test team description',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
}

/**
 * 项目工厂
 */
export const projectFactory = {
  build: (organizationId: string, overrides: Partial<any> = {}) => ({
    id: randomUUID(),
    organizationId,
    name: `Test Project ${Date.now()}`,
    slug: `test-project-${Date.now()}`,
    description: 'Test project description',
    visibility: 'private' as const,
    status: 'active' as const,
    config: {},
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
}

/**
 * 环境工厂
 */
export const environmentFactory = {
  build: (projectId: string, overrides: Partial<any> = {}) => ({
    id: randomUUID(),
    projectId,
    name: `Test Environment ${Date.now()}`,
    type: 'development' as const,
    config: {},
    permissions: [],
    healthStatus: 'healthy' as const,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
}

/**
 * Pipeline 工厂
 */
export const pipelineFactory = {
  build: (projectId: string, overrides: Partial<any> = {}) => ({
    id: randomUUID(),
    projectId,
    name: `Test Pipeline ${Date.now()}`,
    config: {
      stages: [],
    },
    trigger: 'push' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
}

/**
 * 部署工厂
 */
export const deploymentFactory = {
  build: (environmentId: string, overrides: Partial<any> = {}) => ({
    id: randomUUID(),
    environmentId,
    version: '1.0.0',
    commitHash: 'abc123',
    branch: 'main',
    strategy: 'rolling' as const,
    status: 'pending' as const,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
}
