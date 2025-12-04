#!/usr/bin/env bun
/**
 * 修复 HealthStatus 类型使用
 * 应该使用 GitAuthHealthStatus 而不是 HealthStatus
 */

import { readFileSync, writeFileSync } from 'node:fs'

const files = [
  'packages/services/business/src/gitops/credentials/credential-manager.service.ts',
  'packages/services/business/src/gitops/credentials/health-monitor.service.ts',
  'packages/services/business/src/projects/project-status.service.ts',
  'packages/services/business/src/projects/health-monitor.service.ts',
]

for (const file of files) {
  try {
    let content = readFileSync(file, 'utf-8')
    const original = content

    // 1. 修复导入
    if (file.includes('gitops/credentials')) {
      content = content.replace(
        /import type \{([^}]*?)HealthStatus([^}]*?)\} from '@juanie\/types'/g,
        (match, before, after) => {
          // 移除 HealthStatus，添加 GitAuthHealthStatus
          const imports = (before + after)
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s && s !== 'HealthStatus')
          if (!imports.includes('GitAuthHealthStatus')) {
            imports.push('GitAuthHealthStatus')
          }
          return `import type { ${imports.join(', ')} } from '@juanie/types'`
        },
      )

      // 2. 替换类型使用
      content = content.replace(/: HealthStatus/g, ': GitAuthHealthStatus')
      content = content.replace(/<HealthStatus>/g, '<GitAuthHealthStatus>')
      content = content.replace(/Promise<HealthStatus>/g, 'Promise<GitAuthHealthStatus>')

      // 3. 修复返回值结构 - 回滚之前的修改
      content = content.replace(/isHealthy: false/g, "status: 'unhealthy'")
      content = content.replace(/isHealthy: true/g, "status: 'healthy'")
      content = content.replace(/error:/g, 'message:')
      content = content.replace(/health\.isHealthy/g, "health.status === 'healthy'")
      content = content.replace(/!health\.isHealthy/g, "health.status !== 'healthy'")
      content = content.replace(/health\.error/g, 'health.message')
    }

    if (content !== original) {
      writeFileSync(file, content, 'utf-8')
      console.log(`✅ ${file}`)
    }
  } catch (error) {
    console.error(`❌ ${file}:`, error)
  }
}

console.log('\n✨ 完成!')
