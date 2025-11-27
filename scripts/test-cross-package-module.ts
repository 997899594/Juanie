#!/usr/bin/env bun

/**
 * 测试跨包的 NestJS 模块加载
 * 模拟 monorepo 中的包结构
 */

import { Injectable, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'

// ============================================
// 模拟 @juanie/service-business 包
// ============================================

@Injectable()
class GitOpsService {
  constructor(private config: ConfigService) {
    console.log('✅ GitOpsService 成功注入 ConfigService')
  }
}

// 场景 A: GitOpsModule 不导入 ConfigModule
@Module({
  providers: [GitOpsService],
  exports: [GitOpsService],
})
class GitOpsModuleA {}

// 场景 B: GitOpsModule 导入 ConfigModule
@Module({
  imports: [ConfigModule],
  providers: [GitOpsService],
  exports: [GitOpsService],
})
class GitOpsModuleB {}

// BusinessModule 导出 GitOpsModule
@Module({
  imports: [GitOpsModuleA],
  exports: [GitOpsModuleA],
})
class BusinessModuleA {}

@Module({
  imports: [GitOpsModuleB],
  exports: [GitOpsModuleB],
})
class BusinessModuleB {}

// ============================================
// 模拟 apps/api-gateway
// ============================================

// AppModule 导入 BusinessModule
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BusinessModuleA, // 嵌套导入
  ],
})
class AppModuleA {}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BusinessModuleB, // 嵌套导入
  ],
})
class AppModuleB {}

async function testScenarioA() {
  console.log('\n📋 场景 A: 嵌套模块不导入 ConfigModule')
  console.log('AppModule → BusinessModule → GitOpsModule (不导入)')
  console.log('='.repeat(60))
  try {
    const app = await NestFactory.create(AppModuleA, new FastifyAdapter(), { logger: false })
    await app.init()
    console.log('✅ 场景 A 成功 - 全局模块在嵌套模块中也能工作')
    await app.close()
    return true
  } catch (error) {
    console.log('❌ 场景 A 失败:', error.message)
    return false
  }
}

async function testScenarioB() {
  console.log('\n📋 场景 B: 嵌套模块导入 ConfigModule')
  console.log('AppModule → BusinessModule → GitOpsModule (导入)')
  console.log('='.repeat(60))
  try {
    const app = await NestFactory.create(AppModuleB, new FastifyAdapter(), { logger: false })
    await app.init()
    console.log('✅ 场景 B 成功')
    await app.close()
    return true
  } catch (error) {
    console.log('❌ 场景 B 失败:', error.message)
    return false
  }
}

async function main() {
  console.log('🧪 跨包模块加载测试')
  console.log('模拟 monorepo 中的嵌套模块结构')
  console.log('NestJS 版本: 11.1.7\n')

  const resultA = await testScenarioA()
  const resultB = await testScenarioB()

  console.log('\n' + '='.repeat(60))
  console.log('📊 测试结论')
  console.log('='.repeat(60))

  if (resultA) {
    console.log('✅ 全局模块在嵌套模块中正常工作')
    console.log('   即使是 AppModule → BusinessModule → GitOpsModule')
    console.log('   这样的嵌套结构，全局 ConfigModule 也能被注入')
    console.log('')
    console.log('🤔 那么你的应用为什么失败？')
    console.log('   可能的原因：')
    console.log('   1. 模块循环依赖')
    console.log('   2. 模块导入顺序问题')
    console.log('   3. 某些模块在 ConfigModule 注册前就被实例化')
    console.log('   4. TypeScript 编译配置问题')
  } else {
    console.log('❌ 全局模块在嵌套结构中失败')
    console.log('   这可能是 NestJS 的限制或 bug')
  }
}

main().catch(console.error)
