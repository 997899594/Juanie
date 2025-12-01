#!/usr/bin/env bun

/**
 * 诊断进度更新问题
 * 监听 Redis 的进度事件，记录所有更新
 */

import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

console.log('🔍 开始监听进度事件...\n')
console.log('请在另一个终端创建项目，然后观察这里的输出\n')

const updates: Array<{ time: number; progress: number; message: string }> = []
let startTime = 0

redis.subscribe('project:progress', (err) => {
  if (err) {
    console.error('订阅失败:', err)
    process.exit(1)
  }
  console.log('✅ 已订阅 project:progress 频道\n')
})

redis.on('message', (channel, message) => {
  if (channel !== 'project:progress') return

  try {
    const event = JSON.parse(message)
    const now = Date.now()

    if (startTime === 0) {
      startTime = now
    }

    const elapsed = now - startTime

    updates.push({
      time: elapsed,
      progress: event.progress,
      message: event.message,
    })

    console.log(`[+${elapsed}ms] ${event.progress}% - ${event.message}`)

    // 如果达到 100%，显示统计
    if (event.progress === 100) {
      console.log('\n📊 统计信息:')
      console.log(`总更新次数: ${updates.length}`)
      console.log(`总耗时: ${elapsed}ms`)
      console.log(`平均间隔: ${Math.round(elapsed / updates.length)}ms`)

      // 显示进度跳跃
      console.log('\n⚠️ 进度跳跃分析:')
      for (let i = 1; i < updates.length; i++) {
        const prev = updates[i - 1]
        const curr = updates[i]
        const jump = curr.progress - prev.progress
        const timeGap = curr.time - prev.time

        if (jump > 10) {
          console.log(`  ${prev.progress}% -> ${curr.progress}% (跳跃 ${jump}%, 间隔 ${timeGap}ms)`)
        }
      }

      // 重置
      updates.length = 0
      startTime = 0
      console.log('\n---\n')
    }
  } catch (error) {
    console.error('解析消息失败:', error)
  }
})

process.on('SIGINT', () => {
  console.log('\n\n👋 停止监听')
  redis.quit()
  process.exit(0)
})
