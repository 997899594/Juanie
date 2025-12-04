#!/usr/bin/env bun
/**
 * 清理临时脚本
 *
 * 分析 scripts/ 目录中的临时脚本，保留有用的，删除过时的
 */

import { readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

// 保留的脚本（常用工具）
const KEEP_SCRIPTS = [
  // 数据库管理
  'clean-database.ts',

  // 监控工具
  'monitor-progress-events.ts',

  // K3s 设置
  'setup-k3s-remote.sh',

  // 验证工具
  'verify-architecture.ts',
  'verify-git-sync-logs-schema.ts',

  // 迁移工具
  'migrate-to-pino-logger.ts',

  // 诊断工具（保留最新的）
  'check-queue-jobs.ts',

  // 测试工具（保留有用的）
  'test-pino-logger.ts',
]

// 临时脚本模式（应该删除）
const TEMP_PATTERNS = [
  /^fix-.*\.ts$/, // fix-*.ts
  /^diagnose-.*\.ts$/, // diagnose-*.ts
  /^test-.*\.ts$/, // test-*.ts (除了保留列表)
  /^check-.*\.ts$/, // check-*.ts (除了保留列表)
  /^comprehensive-.*\.ts$/, // comprehensive-*.ts
  /^precise-.*\.ts$/, // precise-*.ts
  /^complete-.*\.ts$/, // complete-*.ts
]

interface ScriptInfo {
  name: string
  path: string
  size: number
  shouldKeep: boolean
  reason: string
}

async function analyzeScripts(): Promise<ScriptInfo[]> {
  const scriptsDir = 'scripts'
  const files = await readdir(scriptsDir)
  const scripts: ScriptInfo[] = []

  for (const file of files) {
    if (!file.endsWith('.ts')) continue

    const filePath = join(scriptsDir, file)
    const stats = await stat(filePath)

    // 检查是否在保留列表
    if (KEEP_SCRIPTS.includes(file)) {
      scripts.push({
        name: file,
        path: filePath,
        size: stats.size,
        shouldKeep: true,
        reason: '常用工具',
      })
      continue
    }

    // 检查是否匹配临时模式
    const isTemp = TEMP_PATTERNS.some((pattern) => pattern.test(file))

    if (isTemp) {
      scripts.push({
        name: file,
        path: filePath,
        size: stats.size,
        shouldKeep: false,
        reason: '临时脚本',
      })
    } else {
      scripts.push({
        name: file,
        path: filePath,
        size: stats.size,
        shouldKeep: true,
        reason: '核心工具',
      })
    }
  }

  return scripts
}

async function main() {
  console.log('🔍 分析 scripts/ 目录...\n')

  const scripts = await analyzeScripts()

  // 分组显示
  const toKeep = scripts.filter((s) => s.shouldKeep)
  const toDelete = scripts.filter((s) => !s.shouldKeep)

  console.log('✅ 保留的脚本 (%d 个):\n', toKeep.length)
  for (const script of toKeep) {
    const sizeKB = (script.size / 1024).toFixed(1)
    console.log(`  ${script.name.padEnd(40)} ${sizeKB.padStart(6)} KB  (${script.reason})`)
  }

  console.log('\n❌ 待删除的脚本 (%d 个):\n', toDelete.length)
  for (const script of toDelete) {
    const sizeKB = (script.size / 1024).toFixed(1)
    console.log(`  ${script.name.padEnd(40)} ${sizeKB.padStart(6)} KB  (${script.reason})`)
  }

  // 计算节省的空间
  const totalSize = toDelete.reduce((sum, s) => sum + s.size, 0)
  const totalSizeKB = (totalSize / 1024).toFixed(1)

  console.log('\n📊 统计:')
  console.log(`  总脚本数: ${scripts.length}`)
  console.log(`  保留: ${toKeep.length}`)
  console.log(`  删除: ${toDelete.length}`)
  console.log(`  节省空间: ${totalSizeKB} KB`)

  // 询问是否删除
  console.log('\n⚠️  确认删除这些临时脚本？(y/N)')

  // 在实际使用时，可以添加交互式确认
  // 这里先只显示，不实际删除
  console.log('\n💡 提示: 如果确认无误，可以运行:')
  console.log('  bun run scripts/cleanup-temp-scripts.ts --confirm')

  // 检查是否有 --confirm 参数
  if (process.argv.includes('--confirm')) {
    console.log('\n🗑️  开始删除...\n')

    for (const script of toDelete) {
      try {
        await unlink(script.path)
        console.log(`  ✓ 已删除: ${script.name}`)
      } catch (error) {
        console.error(`  ✗ 删除失败: ${script.name}`, error)
      }
    }

    console.log('\n✨ 清理完成!')
  }
}

main().catch(console.error)
