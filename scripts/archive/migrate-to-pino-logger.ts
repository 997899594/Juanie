#!/usr/bin/env bun
/**
 * 批量迁移到 Pino Logger
 *
 * 将所有服务的 Logger 从 @nestjs/common 迁移到 nestjs-pino
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

interface MigrationResult {
  file: string
  success: boolean
  changes: string[]
  warnings: string[]
  errors: string[]
}

const results: MigrationResult[] = []

/**
 * 递归查找所有 .ts 文件
 */
async function findTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      // 跳过 node_modules 和其他不需要的目录
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo') {
        continue
      }

      if (entry.isDirectory()) {
        const subFiles = await findTypeScriptFiles(fullPath)
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath)
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error)
  }

  return files
}

/**
 * 检查文件是否需要迁移
 */
function needsMigration(content: string): boolean {
  // 检查是否从 @nestjs/common 导入了 Logger
  return /import\s+{[^}]*Logger[^}]*}\s+from\s+['"]@nestjs\/common['"]/.test(content)
}

/**
 * 迁移单个文件
 */
async function migrateFile(filePath: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    file: filePath,
    success: false,
    changes: [],
    warnings: [],
    errors: [],
  }

  try {
    const content = await readFile(filePath, 'utf-8')

    // 检查是否需要迁移
    if (!needsMigration(content)) {
      result.warnings.push('File does not import Logger from @nestjs/common')
      return result
    }

    let newContent = content
    let hasChanges = false

    // 模式 1: import { Injectable, Logger } from '@nestjs/common'
    // 替换为: import { Injectable } from '@nestjs/common'
    //         import { Logger } from '@juanie/core/logger'
    const pattern1 = /import\s+{\s*([^}]*),\s*Logger\s*}\s+from\s+['"]@nestjs\/common['"]/g
    if (pattern1.test(content)) {
      newContent = newContent.replace(pattern1, (match, otherImports) => {
        hasChanges = true
        result.changes.push(`Separated Logger import from other @nestjs/common imports`)

        // 清理空格
        const cleanImports = otherImports.trim()

        return `import { ${cleanImports} } from '@nestjs/common'\nimport { Logger } from '@juanie/core/logger'`
      })
    }

    // 模式 2: import { Logger, Injectable } from '@nestjs/common'
    const pattern2 = /import\s+{\s*Logger\s*,\s*([^}]*)\s*}\s+from\s+['"]@nestjs\/common['"]/g
    if (pattern2.test(newContent)) {
      newContent = newContent.replace(pattern2, (match, otherImports) => {
        hasChanges = true
        result.changes.push(`Separated Logger import (Logger first)`)

        const cleanImports = otherImports.trim()

        return `import { ${cleanImports} } from '@nestjs/common'\nimport { Logger } from '@juanie/core/logger'`
      })
    }

    // 模式 3: import { Logger } from '@nestjs/common' (只有 Logger)
    const pattern3 = /import\s+{\s*Logger\s*}\s+from\s+['"]@nestjs\/common['"]/g
    if (pattern3.test(newContent)) {
      newContent = newContent.replace(pattern3, () => {
        hasChanges = true
        result.changes.push(`Replaced standalone Logger import`)

        return `import { Logger } from '@juanie/core/logger'`
      })
    }

    // 检查是否有其他需要注意的模式
    if (newContent.includes('new Logger(')) {
      result.warnings.push('File uses "new Logger()" - verify it works with Pino')
    }

    if (newContent.includes('Logger.log') || newContent.includes('Logger.error')) {
      result.warnings.push('File uses static Logger methods - may need manual review')
    }

    // 写入文件
    if (hasChanges) {
      await writeFile(filePath, newContent, 'utf-8')
      result.success = true
    } else {
      result.warnings.push('No changes made - pattern not matched')
    }
  } catch (error) {
    result.errors.push(`Error: ${error instanceof Error ? error.message : String(error)}`)
  }

  return result
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 Searching for TypeScript files...\n')

  // 查找所有需要迁移的目录
  const directories = [
    'packages/services/business/src',
    'packages/services/foundation/src',
    'packages/services/extensions/src',
  ]

  const allFiles: string[] = []

  for (const dir of directories) {
    console.log(`📂 Scanning ${dir}...`)
    const files = await findTypeScriptFiles(dir)
    allFiles.push(...files)
  }

  console.log(`\n✅ Found ${allFiles.length} TypeScript files\n`)

  // 过滤出需要迁移的文件
  const filesToMigrate: string[] = []

  for (const file of allFiles) {
    const content = await readFile(file, 'utf-8')
    if (needsMigration(content)) {
      filesToMigrate.push(file)
    }
  }

  console.log(`📝 ${filesToMigrate.length} files need migration\n`)

  if (filesToMigrate.length === 0) {
    console.log('✨ No files need migration!')
    return
  }

  // 显示将要迁移的文件
  console.log('Files to migrate:')
  for (const file of filesToMigrate) {
    console.log(`  - ${file.replace(process.cwd() + '/', '')}`)
  }

  console.log('\n🚀 Starting migration...\n')

  // 迁移所有文件
  for (const file of filesToMigrate) {
    const result = await migrateFile(file)
    results.push(result)

    const shortPath = file.replace(process.cwd() + '/', '')

    if (result.success) {
      console.log(`✅ ${shortPath}`)
      if (result.changes.length > 0) {
        for (const change of result.changes) {
          console.log(`   └─ ${change}`)
        }
      }
    } else {
      console.log(`❌ ${shortPath}`)
    }

    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.log(`   ⚠️  ${warning}`)
      }
    }

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        console.log(`   🔴 ${error}`)
      }
    }
  }

  // 统计结果
  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  const withWarnings = results.filter((r) => r.warnings.length > 0).length

  console.log('\n' + '='.repeat(60))
  console.log('📊 Migration Summary')
  console.log('='.repeat(60))
  console.log(`✅ Successful: ${successful}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⚠️  With warnings: ${withWarnings}`)
  console.log('='.repeat(60))

  // 显示需要手动检查的文件
  const needsReview = results.filter((r) => r.warnings.length > 0 || r.errors.length > 0)

  if (needsReview.length > 0) {
    console.log('\n⚠️  Files that need manual review:')
    for (const result of needsReview) {
      console.log(`\n  ${result.file.replace(process.cwd() + '/', '')}`)
      for (const warning of result.warnings) {
        console.log(`    - ${warning}`)
      }
      for (const error of result.errors) {
        console.log(`    - ${error}`)
      }
    }
  }

  console.log('\n✨ Migration complete!')
  console.log('\n📝 Next steps:')
  console.log('  1. Run: bun run type-check')
  console.log('  2. Run: bun run dev')
  console.log('  3. Check the logs to verify Pino is working')
  console.log('  4. Review files with warnings')
}

main().catch(console.error)
