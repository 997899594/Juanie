#!/usr/bin/env bun
import * as schema from '@juanie/core/database'
import { asc, desc, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const connectionString =
  process.env.DATABASE_URL || 'postgresql://findbiao:biao1996.@localhost:5432/juanie_devops'
const client = postgres(connectionString)
const db = drizzle(client, { schema })

async function checkProject() {
  try {
    // 查找项目名为 11444a 的项目
    const projects = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.name, '11444a'))

    if (projects.length === 0) {
      console.log('❌ 未找到项目名为 "11444a" 的项目')
      console.log('\n尝试模糊搜索...')

      const allProjects = await db
        .select()
        .from(schema.projects)
        .orderBy(desc(schema.projects.createdAt))
        .limit(10)

      console.log('\n最近的 10 个项目:')
      for (const p of allProjects) {
        console.log(`- ${p.name} (${p.id}) - ${p.status}`)
      }
      return
    }

    for (const project of projects) {
      console.log('\n=== 项目信息 ===')
      console.log(`ID: ${project.id}`)
      console.log(`名称: ${project.name}`)
      console.log(`状态: ${project.status}`)
      console.log(`创建时间: ${project.createdAt}`)
      console.log(`初始化完成: ${project.initializationCompletedAt || '未完成'}`)
      if (project.initializationError) {
        console.log(`初始化错误: ${project.initializationError}`)
      }

      // 查询初始化步骤
      const steps = await db
        .select()
        .from(schema.projectInitializationSteps)
        .where(eq(schema.projectInitializationSteps.projectId, project.id))
        .orderBy(asc(schema.projectInitializationSteps.createdAt))

      console.log('\n=== 初始化步骤 ===')
      if (steps.length === 0) {
        console.log('无步骤记录')
      } else {
        for (const step of steps) {
          console.log(`\n步骤: ${step.step}`)
          console.log(`  状态: ${step.status}`)
          console.log(`  进度: ${step.progress}%`)
          console.log(`  开始: ${step.startedAt}`)
          console.log(`  完成: ${step.completedAt || '未完成'}`)
          if (step.error) {
            console.log(`  错误: ${step.error}`)
          }
        }
      }
    }
  } catch (error) {
    console.error('查询失败:', error)
  } finally {
    await client.end()
  }
}

checkProject()
