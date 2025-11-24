#!/usr/bin/env bun

/**
 * 测试 GitOps 资源创建
 */

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../packages/core/database/src/schemas/index'

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

const client = postgres(connectionString)
const db = drizzle(client, { schema })

async function test() {
  console.log('🧪 测试 GitOps 资源创建\n')

  // 获取最新的项目
  const [project] = await db
    .select()
    .from(schema.projects)
    .orderBy(schema.projects.createdAt)
    .limit(1)

  if (!project) {
    console.log('❌ 没有找到项目')
    return
  }

  console.log(`项目: ${project.name} (${project.id})`)

  // 获取仓库
  const [repository] = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.projectId, project.id))
    .limit(1)

  if (!repository) {
    console.log('❌ 没有找到仓库')
    return
  }

  console.log(`仓库: ${repository.fullName}`)

  // 获取环境
  const environments = await db
    .select()
    .from(schema.environments)
    .where(eq(schema.environments.projectId, project.id))

  console.log(`环境数量: ${environments.length}`)

  // 尝试动态导入服务
  console.log('\n📦 测试动态导入...')
  try {
    const { FluxResourcesService, K3sService, YamlGeneratorService, FluxMetricsService } =
      await import('@juanie/service-business')

    console.log('✅ 服务导入成功')

    // 测试创建服务实例
    const { ConfigService } = await import('@nestjs/config')
    const { EventEmitter2 } = await import('@nestjs/event-emitter')

    const config = new ConfigService()
    const eventEmitter = new EventEmitter2()
    const k3sService = new K3sService(config as any, eventEmitter)

    await k3sService.onModuleInit()

    if (!k3sService.isK3sConnected()) {
      console.log('❌ K3s 未连接')
      return
    }

    console.log('✅ K3s 已连接')

    const yamlGenerator = new YamlGeneratorService()
    const metricsService = new FluxMetricsService()
    const fluxResources = new FluxResourcesService(
      db,
      config as any,
      k3sService,
      yamlGenerator,
      metricsService,
    )

    console.log('✅ 服务实例创建成功')

    // 测试 setupProjectGitOps
    console.log('\n🚀 测试 setupProjectGitOps...')
    console.log('注意: 需要有效的 OAuth 访问令牌')
  } catch (error) {
    console.error('❌ 导入或创建服务失败:', error)
  }

  await client.end()
}

test().catch(console.error)
