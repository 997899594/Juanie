#!/usr/bin/env bun
/**
 * 实时监控 GitOps 创建日志
 */

import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

console.log('🔍 监控 GitOps 日志...\n')
console.log('请在 Web UI 中创建项目\n')

// 监听所有项目的事件
redis.psubscribe('project:*', (err, count) => {
  if (err) {
    console.error('订阅失败:', err)
    process.exit(1)
  }
  console.log(`✅ 已订阅 ${count} 个频道\n`)
})

redis.on('pmessage', (pattern, channel, message) => {
  try {
    const event = JSON.parse(message)
    const timestamp = new Date(event.timestamp).toLocaleTimeString()

    console.log(`[${timestamp}] ${event.type}`)
    if (event.data.message) {
      console.log(`  📝 ${event.data.message}`)
    }
    if (event.data.error) {
      console.log(`  ❌ ${event.data.error}`)
    }
    if (event.data.progress !== undefined) {
      console.log(`  📊 进度: ${event.data.progress}%`)
    }
    console.log()
  } catch (error) {
    console.log(`[RAW] ${message}`)
  }
})

process.on('SIGINT', () => {
  console.log('\n👋 停止监控')
  redis.disconnect()
  process.exit(0)
})
