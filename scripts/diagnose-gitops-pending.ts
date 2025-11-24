#!/usr/bin/env bun

/**
 * GitOps Pending 状态诊断脚本
 *
 * 检查：
 * 1. 数据库中的 gitops_resources 状态
 * 2. K8s 集群中的实际资源
 * 3. 找出不匹配的原因
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

async function diagnose() {
  console.log('🔍 GitOps 资源诊断\n')

  // 1. 查询数据库中的 gitops_resources
  console.log('📊 数据库中的 GitOps 资源：')
  const resources = await db
    .select()
    .from(schema.gitopsResources)
    .orderBy(schema.gitopsResources.createdAt)

  console.log(`总共 ${resources.length} 条记录\n`)

  // 按状态分组
  const byStatus = resources.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  console.log('状态分布：')
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${count}`)
  }
  console.log()

  // 按项目分组
  const byProject = resources.reduce(
    (acc, r) => {
      if (!acc[r.projectId]) {
        acc[r.projectId] = []
      }
      acc[r.projectId].push(r)
      return acc
    },
    {} as Record<string, typeof resources>,
  )

  console.log(`📦 按项目分组（${Object.keys(byProject).length} 个项目）：\n`)

  for (const [projectId, projectResources] of Object.entries(byProject)) {
    console.log(`项目 ID: ${projectId}`)
    console.log(`  资源数量: ${projectResources.length}`)

    const statusCount = projectResources.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    console.log(`  状态: ${JSON.stringify(statusCount)}`)

    // 显示每个资源的详情
    for (const resource of projectResources) {
      console.log(
        `    - ${resource.type}: ${resource.name} (${resource.namespace}) - ${resource.status}`,
      )
      if (resource.errorMessage) {
        console.log(`      错误: ${resource.errorMessage}`)
      }
    }
    console.log()
  }

  // 2. 检查 K3s 连接
  console.log('🔌 K3s 连接检查：')
  const kubeconfigPath = process.env.K3S_KUBECONFIG_PATH || process.env.KUBECONFIG_PATH
  if (!kubeconfigPath) {
    console.log('  ❌ 未配置 K3S_KUBECONFIG_PATH')
  } else {
    console.log(`  ✅ Kubeconfig 路径: ${kubeconfigPath}`)
  }
  console.log()

  // 3. 建议
  console.log('💡 诊断建议：\n')

  const pendingCount = byStatus['pending'] || 0
  if (pendingCount > 0) {
    console.log(`⚠️  发现 ${pendingCount} 个 pending 状态的资源`)
    console.log()
    console.log('可能的原因：')
    console.log('1. 项目初始化时 K3s 未连接')
    console.log('2. createGitOpsResources 方法执行失败')
    console.log('3. OAuth 访问令牌不可用')
    console.log()
    console.log('解决方案：')
    console.log('1. 确保 K3s 集群运行: kubectl get nodes')
    console.log('2. 检查环境变量: K3S_KUBECONFIG_PATH')
    console.log('3. 重新创建项目，或手动触发 GitOps 资源创建')
    console.log()
    console.log('手动创建命令：')
    console.log('  export KUBECONFIG=~/.kube/k3s-remote.yaml')
    console.log('  kubectl get namespaces | grep project-')
    console.log('  kubectl get gitrepositories -A')
    console.log('  kubectl get kustomizations -A')
  }

  await client.end()
}

diagnose().catch(console.error)
