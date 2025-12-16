/**
 * 迁移脚本：将 PinoLogger 依赖注入模式改回 NestJS 标准 Logger
 *
 * 变更：
 * 1. constructor 中的 `private readonly logger: Logger` 改为类属性 `private readonly logger = new Logger(ClassName.name)`
 * 2. 删除 `this.logger.setContext(...)` 和 `this.logger.assign(...)` 调用
 * 3. 将 `this.logger.info(...)` 改为 `this.logger.log(...)`
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

const targetDirs = [
  'packages/services/foundation/src',
  'packages/services/business/src',
  'packages/services/extensions/src',
  'packages/core/src/queue',
  'packages/core/src/events',
  'packages/core/src/sse',
]

function processFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8')

  // 检查是否需要处理
  if (
    !content.includes('private readonly logger: Logger') &&
    !content.includes('private readonly logger: Logger,')
  ) {
    return false
  }

  let newContent = content

  // 1. 提取类名
  const classMatch = content.match(/export class (\w+)/)
  if (!classMatch) {
    console.log(`  跳过 ${filePath}: 未找到类定义`)
    return false
  }
  const className = classMatch[1]

  // 2. 替换 constructor 中的 logger 参数
  // 匹配 `private readonly logger: Logger,` 或 `private readonly logger: Logger)`
  newContent = newContent.replace(/,?\s*private readonly logger: Logger,?/g, '')

  // 3. 删除 setContext 和 assign 调用
  newContent = newContent.replace(/\s*this\.logger\.setContext\([^)]+\)\s*;?\s*/g, '')
  newContent = newContent.replace(/\s*this\.logger\.assign\(\{[^}]+\}\)\s*;?\s*/g, '')

  // 4. 在类定义后添加 logger 属性
  newContent = newContent.replace(
    new RegExp(`(export class ${className}[^{]*\\{)`),
    `$1\n  private readonly logger = new Logger(${className}.name)\n`,
  )

  // 5. 将 this.logger.info 改为 this.logger.log
  newContent = newContent.replace(/this\.logger\.info\(/g, 'this.logger.log(')

  // 6. 清理空的构造函数参数
  newContent = newContent.replace(/constructor\(\s*,/g, 'constructor(')
  newContent = newContent.replace(/,\s*\)/g, ')')
  newContent = newContent.replace(/\(\s*,\s*/g, '(')

  if (newContent !== content) {
    writeFileSync(filePath, newContent)
    console.log(`  已处理: ${filePath}`)
    return true
  }

  return false
}

function walkDir(dir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)

  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...walkDir(fullPath))
    } else if (item.endsWith('.ts') && !item.endsWith('.spec.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

console.log('开始迁移 Logger...\n')

let processedCount = 0

for (const dir of targetDirs) {
  console.log(`处理目录: ${dir}`)
  try {
    const files = walkDir(dir)
    for (const file of files) {
      if (processFile(file)) {
        processedCount++
      }
    }
  } catch (e) {
    console.log(`  目录不存在或无法访问: ${dir}`)
  }
}

console.log(`\n完成! 共处理 ${processedCount} 个文件`)
