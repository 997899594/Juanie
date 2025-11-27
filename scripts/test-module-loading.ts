#!/usr/bin/env bun

/**
 * 测试 NestJS 模块加载顺序和全局模块行为
 */

import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'

// 测试服务 - 需要注入 ConfigService
class TestService {
  constructor(private config: ConfigService) {
    console.log('✅ TestService 成功注入 ConfigService')
    console.log('   NODE_ENV:', this.config.get('NODE_ENV'))
  }
}

// 测试模块 1 - 不导入 ConfigModule
@Module({
  providers: [TestService],
})
class TestModule1 {}

// 测试模块 2 - 导入 ConfigModule
@Module({
  imports: [ConfigModule],
  providers: [TestService],
})
class TestModule2 {}

// 根模块 - ConfigModule 设为全局
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TestModule1, // 不导入 ConfigModule
  ],
})
class AppModule1 {}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TestModule2, // 导入 ConfigModule
  ],
})
class AppModule2 {}

async function testScenario1() {
  console.log('\n📋 测试场景 1: 子模块不导入 ConfigModule')
  console.log('='.repeat(50))
  try {
    const app = await NestFactory.create(AppModule1, new FastifyAdapter(), { logger: false })
    await app.init()
    console.log('✅ 场景 1 成功')
    await app.close()
  } catch (error) {
    console.log('❌ 场景 1 失败:', error.message)
  }
}

async function testScenario2() {
  console.log('\n📋 测试场景 2: 子模块导入 ConfigModule')
  console.log('='.repeat(50))
  try {
    const app = await NestFactory.create(AppModule2, new FastifyAdapter(), { logger: false })
    await app.init()
    console.log('✅ 场景 2 成功')
    await app.close()
  } catch (error) {
    console.log('❌ 场景 2 失败:', error.message)
  }
}

async function main() {
  console.log('🧪 NestJS 全局模块行为测试')
  console.log('NestJS 版本: 11.1.7')
  console.log('运行时: Bun')

  await testScenario1()
  await testScenario2()

  console.log('\n' + '='.repeat(50))
  console.log('📊 测试总结')
  console.log('='.repeat(50))
  console.log('如果场景 1 失败，说明在当前环境中，')
  console.log('即使 ConfigModule 设为全局，子模块仍需显式导入。')
}

main().catch(console.error)
