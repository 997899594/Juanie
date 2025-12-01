#!/usr/bin/env bun

/**
 * 监听项目初始化的进度事件
 * 用于诊断进度回退问题
 */

import Redis from 'ioredis'

const projectId = process.argv[2]

if (!projectId) {
  console.error('Usage: bun run scripts/monitor-progress-events.ts <projectId>')
  process.exit(1)
}

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

console.log(`🔍 监听项目 ${projectId} 的进度事件...\n`)

const events: any[] = []

redis.subscribe(`project:${projectId}`, (err) => {
  if (err) {
    console.error('订阅失败:', err)
    process.exit(1)
  }
  console.log(`✅ 已订阅 project:${projectId}\n`)
})

redis.on('message', (channel, message) => {
  try {
    const event = JSON.parse(message)
    const timestamp = new Date(event.timestamp).toLocaleTimeString()

    events.push(event)

    console.log(`[${timestamp}] ${event.type}`)

    if (event.type === 'initialization.progress') {
      const { progress, message } = event.data
      console.log(`  进度: ${progress}%`)
      console.log(`  消息: ${message}`)

      // 检查进度回退
      if (events.length > 1) {
        const prevEvent = events[events.length - 2]
        if (prevEvent.type === 'initialization.progress') {
          const prevProgress = prevEvent.data.progress
          if (progress < prevProgress) {
            console.log(`  ⚠️  进度回退！${prevProgress}% -> ${progress}%`)
          }
        }
      }
    } else if (event.type === 'initialization.completed') {
      console.log(`  ✅ 初始化完成`)
    } else if (event.type === 'initialization.failed') {
      console.log(`  ❌ 初始化失败: ${event.data.error}`)
    }

    console.log()
  } catch (error) {
    console.error('解析事件失败:', error)
  }
})

// Ctrl+C 退出时显示统计
process.on('SIGINT', () => {
  console.log('\n\n📊 事件统计:')
  console.log(`总共收到 ${events.length} 个事件\n`)

  const progressEvents = events.filter((e) => e.type === 'initialization.progress')
  console.log(`进度事件: ${progressEvents.length}`)

  if (progressEvents.length > 0) {
    console.log('\n进度序列:')
    progressEvents.forEach((e, i) => {
      const progress = e.data.progress
      const message = e.data.message
      console.log(`  ${i + 1}. ${progress}% - ${message}`)
    })

    // 检查单调性
    let hasRegression = false
    for (let i = 1; i < progressEvents.length; i++) {
      const prev = progressEvents[i - 1].data.progress
      const curr = progressEvents[i].data.progress
      if (curr < prev) {
        console.log(`\n⚠️  发现进度回退: ${prev}% -> ${curr}%`)
        hasRegression = true
      }
    }

    if (!hasRegression) {
      console.log('\n✅ 进度单调性正常')
    }
  }

  redis.quit()
  process.exit(0)
})
