#!/usr/bin/env bun
/**
 * 批量修复常见的 TypeScript 类型错误
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function* walkFiles(dir: string, pattern: RegExp): Generator<string> {
  const files = readdirSync(dir)
  for (const file of files) {
    const path = join(dir, file)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('dist')) {
        yield* walkFiles(path, pattern)
      }
    } else if (pattern.test(file)) {
      yield path
    }
  }
}

// 修复 error 类型守卫
function fixErrorTypeGuards(content: string): string {
  // 修复所有 error 相关的访问
  const errorPatterns = [
    // error.message
    [/\berror\.message\b/g, '(error instanceof Error ? error.message : String(error))'],
    // error.stack
    [/\berror\.stack\b/g, '(error instanceof Error ? error.stack : undefined)'],
    // error.code
    [
      /\berror\.code\b/g,
      '(error instanceof Error && "code" in error ? (error as any).code : undefined)',
    ],
  ]

  for (const [pattern, replacement] of errorPatterns) {
    // 只替换不在 instanceof Error 检查后的
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      if (line.match(pattern) && !line.includes('instanceof Error')) {
        lines[i] = line.replace(pattern as RegExp, replacement as string)
      }
    }
    content = lines.join('\n')
  }

  return content
}

// 修复 decrypt/decryptData 方法名
function fixDecryptMethod(content: string): string {
  return content.replace(/\.decryptData\(/g, '.decrypt(')
}

// 修复 mapGitPermissionToProjectRole 导出
function fixPermissionMapperExport(content: string): string {
  if (content.includes('export function mapGitPermissionToProjectRole')) {
    return content
  }

  // 如果文件中有这个函数但没有导出，添加导出
  if (content.includes('function mapGitPermissionToProjectRole')) {
    content = content.replace(
      'function mapGitPermissionToProjectRole',
      'export function mapGitPermissionToProjectRole',
    )
  }

  return content
}

function main() {
  console.log('🔧 开始修复类型错误...\n')

  // 查找所有 TypeScript 文件
  const files = Array.from(walkFiles('packages/services', /\.ts$/)).filter(
    (f) => !f.endsWith('.d.ts'),
  )

  let fixedCount = 0

  for (const file of files) {
    try {
      let content = readFileSync(file, 'utf-8')
      const original = content

      // 应用修复
      content = fixErrorTypeGuards(content)
      content = fixDecryptMethod(content)
      content = fixPermissionMapperExport(content)

      // 如果有变化，写回文件
      if (content !== original) {
        writeFileSync(file, content, 'utf-8')
        console.log(`✅ 修复: ${file}`)
        fixedCount++
      }
    } catch (error) {
      console.error(`❌ 处理文件失败 ${file}:`, error)
    }
  }

  console.log(`\n✨ 完成! 修复了 ${fixedCount} 个文件`)
}

main()
