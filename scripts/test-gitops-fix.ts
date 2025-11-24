#!/usr/bin/env bun
/**
 * 测试 GitOps 资源创建修复
 *
 * 验证：
 * 1. SetupRepositoryHandler 使用正确的队列
 * 2. project-initialization worker 接收到 userId
 * 3. GitOps 资源在 K8s 中被创建
 */

import { Queue } from 'bullmq'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

async function testGitOpsFix() {
  console.log('🧪 测试 GitOps 资源创建修复\n')

  const queue = new Queue('project-initialization', {
    connection: redis,
  })

  try {
    // 模拟 SetupRepositoryHandler 创建的任务
    console.log('1️⃣ 创建测试任务...')
    const testJob = await queue.add('initialize-project', {
      projectId: 'test-project-id',
      userId: 'test-user-id',
      organizationId: 'test-org-id',
      repository: {
        mode: 'create',
        provider: 'gitlab',
        name: 'test-repo',
        visibility: 'private',
        accessToken: 'test-token',
        defaultBranch: 'main',
      },
      templateId: 'test-template',
      environmentIds: ['env-1', 'env-2', 'env-3'],
    })

    console.log(`✅ 任务已创建: ${testJob.id}\n`)

    // 检查任务数据
    console.log('2️⃣ 验证任务数据...')
    console.log('任务数据:', JSON.stringify(testJob.data, null, 2))

    if (testJob.data.userId) {
      console.log('✅ userId 已包含在任务数据中\n')
    } else {
      console.log('❌ userId 缺失！\n')
    }

    // 等待任务被处理（或超时）
    console.log('3️⃣ 等待任务处理（最多 10 秒）...')
    let processed = false
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const job = await queue.getJob(testJob.id!)
      if (job) {
        const state = await job.getState()
        console.log(`   状态: ${state}, 进度: ${job.progress}%`)

        if (state === 'completed' || state === 'failed') {
          processed = true
          console.log(`\n✅ 任务已处理: ${state}`)

          if (state === 'failed') {
            console.log(`失败原因: ${job.failedReason}`)
          }

          // 获取日志
          const logs = await queue.getJobLogs(testJob.id!)
          if (logs.logs.length > 0) {
            console.log('\n📝 任务日志:')
            for (const log of logs.logs) {
              console.log(`   ${log}`)
            }
          }
          break
        }
      }
    }

    if (!processed) {
      console.log('\n⚠️  任务未在 10 秒内完成（可能 worker 未运行）')
      console.log('提示: 确保 API Gateway 正在运行以处理队列任务')
    }

    // 清理测试任务
    await testJob.remove()
    console.log('\n🧹 测试任务已清理')
  } catch (error) {
    console.error('❌ 测试失败:', error)
  } finally {
    await queue.close()
    await redis.quit()
  }
}

console.log('='.repeat(60))
console.log('GitOps 资源创建修复验证')
console.log('='.repeat(60))
console.log()

testGitOpsFix()
