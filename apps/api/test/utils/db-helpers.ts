/**
 * 数据库辅助函数
 * 用于在测试中操作数据库
 */

import * as schema from '../../src/database/schemas'
import { getTestDatabase } from '../test-database'
import {
  deploymentFactory,
  environmentFactory,
  organizationFactory,
  pipelineFactory,
  projectFactory,
  teamFactory,
  userFactory,
} from './factories'

const db = getTestDatabase()

/**
 * 创建测试用户
 */
export async function createTestUser(overrides: Partial<any> = {}) {
  const userData = userFactory.build(overrides)
  const [user] = await db.insert(schema.users).values(userData).returning()
  return user
}

/**
 * 创建测试组织（自动添加创建者为 owner）
 */
export async function createTestOrganization(userId: string, overrides: Partial<any> = {}) {
  const orgData = organizationFactory.build(overrides)

  return await db.transaction(async (tx) => {
    const [org] = await tx.insert(schema.organizations).values(orgData).returning()

    await tx.insert(schema.organizationMembers).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      userId,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    })

    return org
  })
}

/**
 * 创建测试团队
 */
export async function createTestTeam(organizationId: string, overrides: Partial<any> = {}) {
  const teamData = teamFactory.build(organizationId, overrides)
  const [team] = await db.insert(schema.teams).values(teamData).returning()
  return team
}

/**
 * 添加团队成员
 */
export async function addTeamMember(
  teamId: string,
  userId: string,
  role: 'owner' | 'maintainer' | 'member' = 'member',
) {
  const [member] = await db
    .insert(schema.teamMembers)
    .values({
      id: crypto.randomUUID(),
      teamId,
      userId,
      role,
      joinedAt: new Date(),
    })
    .returning()
  return member
}

/**
 * 创建测试项目
 */
export async function createTestProject(organizationId: string, overrides: Partial<any> = {}) {
  const projectData = projectFactory.build(organizationId, overrides)
  const [project] = await db.insert(schema.projects).values(projectData).returning()
  return project
}

/**
 * 添加项目成员
 */
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: 'owner' | 'maintainer' | 'developer' | 'viewer' = 'developer',
) {
  const [member] = await db
    .insert(schema.projectMembers)
    .values({
      id: crypto.randomUUID(),
      projectId,
      userId,
      role,
      joinedAt: new Date(),
    })
    .returning()
  return member
}

/**
 * 创建测试环境
 */
export async function createTestEnvironment(projectId: string, overrides: Partial<any> = {}) {
  const envData = environmentFactory.build(projectId, overrides)
  const [environment] = await db.insert(schema.environments).values(envData).returning()
  return environment
}

/**
 * 创建测试 Pipeline
 */
export async function createTestPipeline(projectId: string, overrides: Partial<any> = {}) {
  const pipelineData = pipelineFactory.build(projectId, overrides)
  const [pipeline] = await db.insert(schema.pipelines).values(pipelineData).returning()
  return pipeline
}

/**
 * 创建测试部署
 */
export async function createTestDeployment(environmentId: string, overrides: Partial<any> = {}) {
  const deploymentData = deploymentFactory.build(environmentId, overrides)
  const [deployment] = await db.insert(schema.deployments).values(deploymentData).returning()
  return deployment
}

/**
 * 创建完整的测试场景（用户 -> 组织 -> 项目 -> 环境）
 */
export async function createTestScenario() {
  const user = await createTestUser()
  const org = await createTestOrganization(user.id)
  const project = await createTestProject(org.id)
  const environment = await createTestEnvironment(project.id)

  return {
    user,
    org,
    project,
    environment,
  }
}
