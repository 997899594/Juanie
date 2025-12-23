#!/usr/bin/env bun
/**
 * 初始化项目模板数据
 * 将 templates/nextjs-15-app 注册到数据库
 */

import * as schema from '@juanie/core/database'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set')
  process.exit(1)
}

const client = postgres(DATABASE_URL)
const db = drizzle(client, { schema })

async function seedTemplates() {
  console.log('🌱 Seeding project templates...')

  try {
    // 检查是否已存在 nextjs-15-app 模板
    const existing = await db.query.projectTemplates.findFirst({
      where: eq(schema.projectTemplates.slug, 'nextjs-15-app'),
    })

    if (existing) {
      console.log('✅ Template already exists, updating...')

      // 更新现有模板
      await db
        .update(schema.projectTemplates)
        .set({
          name: 'Next.js 15 App Router',
          description: '现代化的 Next.js 全栈应用模板，包含完整的 K8s 配置和 CI/CD 流程',
          category: 'web',
          isPublic: true,
          isSystem: true,
          techStack: {
            language: 'TypeScript',
            framework: 'Next.js 15',
            runtime: 'Node.js 20',
          },
          defaultConfig: {
            environments: [
              { name: 'Development', type: 'development' },
              { name: 'Staging', type: 'staging' },
              { name: 'Production', type: 'production' },
            ],
            resources: {
              requests: { cpu: '100m', memory: '128Mi' },
              limits: { cpu: '500m', memory: '512Mi' },
            },
            healthCheck: {
              path: '/api/health',
              periodSeconds: 10,
            },
            gitops: {
              enabled: true,
              syncInterval: '1m',
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.projectTemplates.id, existing.id))

      console.log('✅ Template updated successfully')
    } else {
      console.log('✅ Creating new template...')

      // 创建新模板
      await db.insert(schema.projectTemplates).values({
        slug: 'nextjs-15-app',
        name: 'Next.js 15 App Router',
        description: '现代化的 Next.js 全栈应用模板，包含完整的 K8s 配置和 CI/CD 流程',
        category: 'web',
        isPublic: true,
        isSystem: true,
        techStack: {
          language: 'TypeScript',
          framework: 'Next.js 15',
          runtime: 'Node.js 20',
        },
        defaultConfig: {
          environments: [
            { name: 'Development', type: 'development' },
            { name: 'Staging', type: 'staging' },
            { name: 'Production', type: 'production' },
          ],
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
          healthCheck: {
            path: '/api/health',
            periodSeconds: 10,
          },
          gitops: {
            enabled: true,
            syncInterval: '1m',
          },
        },
      })

      console.log('✅ Template created successfully')
    }

    console.log('\n✅ Seeding completed!')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

seedTemplates()
