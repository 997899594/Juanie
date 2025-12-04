#!/usr/bin/env bun
/**
 * 替换前端 console.log 为 Logger
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

interface ReplaceResult {
  file: string
  replacements: number
  success: boolean
  error?: string
}

async function findVueAndTsFiles(dir: string, basePath = ''): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const relativePath = basePath ? join(basePath, entry.name) : entry.name

    if (entry.name === 'node_modules' || entry.name === 'dist') continue

    if (entry.isDirectory()) {
      const subFiles = await findVueAndTsFiles(fullPath, relativePath)
      files.push(...subFiles)
    } else if (entry.isFile() && (entry.name.endsWith('.vue') || entry.name.endsWith('.ts'))) {
      files.push(relativePath)
    }
  }

  return files
}

async function replaceInFile(filePath: string): Promise<ReplaceResult> {
  const result: ReplaceResult = {
    file: filePath,
    replacements: 0,
    success: false,
  }

  try {
    const fullPath = join('apps/web/src', filePath)
    let content = await readFile(fullPath, 'utf-8')
    const originalContent = content

    // 检查是否已经导入了 log
    const hasLogImport = /import\s+{\s*[^}]*log[^}]*}\s+from\s+['"]@juanie\/ui['"]/.test(content)

    // 统计 console 使用次数
    const consoleMatches = content.match(/console\.(log|error|warn|info|debug)/g)
    if (!consoleMatches || consoleMatches.length === 0) {
      result.success = true
      return result
    }

    // 替换 console.log -> log.info
    content = content.replace(/console\.log\(/g, 'log.info(')

    // 替换 console.error -> log.error
    content = content.replace(/console\.error\(/g, 'log.error(')

    // 替换 console.warn -> log.warn
    content = content.replace(/console\.warn\(/g, 'log.warn(')

    // 替换 console.info -> log.info
    content = content.replace(/console\.info\(/g, 'log.info(')

    // 替换 console.debug -> log.debug
    content = content.replace(/console\.debug\(/g, 'log.debug(')

    // 如果没有导入 log，添加导入
    if (!hasLogImport && content !== originalContent) {
      // 查找是否有其他 @juanie/ui 的导入
      const uiImportMatch = content.match(/import\s+{([^}]+)}\s+from\s+['"]@juanie\/ui['"]/)

      if (uiImportMatch) {
        // 已有导入，添加 log
        const imports = uiImportMatch[1]
        const newImports = imports.trim() + ', log'
        content = content.replace(uiImportMatch[0], `import { ${newImports} } from '@juanie/ui'`)
      } else {
        // 没有导入，在文件开头添加
        // 找到第一个 import 语句的位置
        const firstImportMatch = content.match(/^import\s+/m)
        if (firstImportMatch) {
          const insertPos = content.indexOf(firstImportMatch[0])
          content =
            content.slice(0, insertPos) +
            "import { log } from '@juanie/ui'\n" +
            content.slice(insertPos)
        } else {
          // 没有任何 import，在 <script> 标签后添加
          const scriptMatch = content.match(/<script[^>]*>/)
          if (scriptMatch) {
            const insertPos = content.indexOf(scriptMatch[0]) + scriptMatch[0].length
            content =
              content.slice(0, insertPos) +
              "\nimport { log } from '@juanie/ui'\n" +
              content.slice(insertPos)
          }
        }
      }
    }

    result.replacements = consoleMatches.length

    if (content !== originalContent) {
      await writeFile(fullPath, content, 'utf-8')
      result.success = true
    } else {
      result.success = true
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  }

  return result
}

async function main() {
  console.log('🔍 查找前端文件...\n')

  const files = await findVueAndTsFiles('apps/web/src')
  console.log(`找到 ${files.length} 个文件\n`)

  console.log('🔄 开始替换 console.log...\n')

  const results: ReplaceResult[] = []
  let totalReplacements = 0

  for (const file of files) {
    const result = await replaceInFile(file)
    if (result.replacements > 0) {
      results.push(result)
      totalReplacements += result.replacements

      if (result.success) {
        console.log(`✅ ${file.padEnd(60)} (${result.replacements} 处)`)
      } else {
        console.log(`❌ ${file.padEnd(60)} (失败: ${result.error})`)
      }
    }
  }

  console.log('\n📊 统计:')
  console.log(`  处理文件: ${results.length}`)
  console.log(`  总替换数: ${totalReplacements}`)
  console.log(`  成功: ${results.filter((r) => r.success).length}`)
  console.log(`  失败: ${results.filter((r) => !r.success).length}`)

  console.log('\n✨ 替换完成!')
  console.log('\n💡 下一步:')
  console.log('  1. 运行 bun run type-check 检查类型')
  console.log('  2. 运行 bun run dev 测试功能')
  console.log('  3. 检查日志输出是否正常')
}

main().catch(console.error)
