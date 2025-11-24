#!/usr/bin/env bun
/**
 * 检查 BullMQ 队列中的任务数据
 */

import { Queue } from 'bullmq'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

async function checkQueueJobs() {
  console.log('🔍 检查 BullMQ 队列任务\n')

  const queueName = 'project-initialization'
  const queue = new Queue(queueName, {
    connection: redis,
  })

  try {
    // 获取最近的任务
    const completed = await queue.getCompleted(0, 10)
    const failed = await queue.getFailed(0, 10)
    const active = await queue.getActive(0, 10)
    const waiting = await queue.getWaiting(0, 10)

    console.log(`📊 队列统计：`)
    console.log(`  - 已完成: ${completed.length}`)
    console.log(`  - 失败: ${failed.length}`)
    console.log(`  - 活跃: ${active.length}`)
    console.log(`  - 等待: ${waiting.length}\n`)

    // 检查最近完成的任务
    if (completed.length > 0) {
      console.log('✅ 最近完成的任务：\n')
      for (const job of completed.slice(0, 3)) {
        console.log(`任务 ID: ${job.id}`)
        console.log(`任务名称: ${job.name}`)
        console.log(`任务数据:`, JSON.stringify(job.data, null, 2))
        console.log(`返回值:`, JSON.stringify(job.returnvalue, null, 2))
        console.log(`进度: ${job.progress}%`)
        console.log(`完成时间: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'N/A'}`)
        console.log('---\n')
      }
    }

    // 检查失败的任务
    if (failed.length > 0) {
      console.log('❌ 失败的任务：\n')
      for (const job of failed.slice(0, 3)) {
        console.log(`任务 ID: ${job.id}`)
        console.log(`任务名称: ${job.name}`)
        console.log(`任务数据:`, JSON.stringify(job.data, null, 2))
        console.log(`失败原因: ${job.failedReason}`)
        console.log(`失败时间: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'N/A'}`)
        console.log('---\n')
      }
    }

    // 检查活跃的任务
    if (active.length > 0) {
      console.log('🔄 活跃的任务：\n')
      for (const job of active) {
        console.log(`任务 ID: ${job.id}`)
        console.log(`任务名称: ${job.name}`)
        console.log(`任务数据:`, JSON.stringify(job.data, null, 2))
        console.log(`进度: ${job.progress}%`)
        console.log('---\n')
      }
    }

    // 检查等待的任务
    if (waiting.length > 0) {
      console.log('⏳ 等待的任务：\n')
      for (const job of waiting) {
        console.log(`任务 ID: ${job.id}`)
        console.log(`任务名称: ${job.name}`)
        console.log(`任务数据:`, JSON.stringify(job.data, null, 2))
        console.log('---\n')
      }
    }

    // 获取任务日志
    if (completed.length > 0) {
      const latestJob = completed[0]
      const logs = await queue.getJobLogs(latestJob.id!)
      if (logs.logs.length > 0) {
        console.log(`\n📝 最新任务 (${latestJob.id}) 的日志：\n`)
        for (const log of logs.logs) {
          console.log(log)
        }
      }
    }
  } catch (error) {
    console.error('❌ 检查队列失败:', error)
  } finally {
    await queue.close()
    await redis.quit()
  }
}

checkQueueJobs()
