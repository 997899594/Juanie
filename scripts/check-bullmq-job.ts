#!/usr/bin/env bun
import { Queue } from 'bullmq'
import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const redis = new Redis(redisUrl)

const queue = new Queue('project-initialization', {
  connection: redis,
})

async function main() {
  console.log('🔍 Checking BullMQ jobs for project: e6d2133f-0a7d-4840-be03-5686ae1164fb\n')

  // 获取所有已完成的任务
  const completed = await queue.getCompleted(0, 100)

  console.log(`Found ${completed.length} completed jobs\n`)

  // 查找项目相关的任务
  for (const job of completed) {
    if (job.data.projectId === 'e6d2133f-0a7d-4840-be03-5686ae1164fb') {
      console.log(`Job ID: ${job.id}`)
      console.log(`Job Name: ${job.name}`)
      console.log(`Created: ${new Date(job.timestamp)}`)
      console.log(`\nJob Data:`)
      console.log(JSON.stringify(job.data, null, 2))
      console.log(`\n---\n`)

      // 获取任务日志
      const logs = await queue.getJobLogs(job.id!)
      if (logs.logs.length > 0) {
        console.log('Job Logs:')
        for (const log of logs.logs) {
          console.log(`  ${log}`)
        }
      }

      console.log('\n===\n')
    }
  }

  await redis.quit()
  process.exit(0)
}

main().catch(console.error)
