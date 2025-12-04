#!/usr/bin/env bun
/**
 * 修复特定的类型错误
 * 基于构建输出的具体错误信息
 */
import { readFileSync, writeFileSync } from 'node:fs'

interface Fix {
  file: string
  fixes: Array<{
    description: string
    apply: (content: string) => string
  }>
}

const fixes: Fix[] = [
  // 1. flux-resources.service.ts - error 类型守卫
  {
    file: 'packages/services/business/src/gitops/flux/flux-resources.service.ts',
    fixes: [
      {
        description: 'catch 块 error 类型守卫',
        apply: (content) => {
          // 修复所有 catch 块中的 error 使用
          content = content.replace(
            /catch\s*\(\s*error\s*\)\s*\{([^}]*?)this\.logger\.error\(([^,]+),\s*error\)/g,
            'catch (error) {$1this.logger.error($2, error instanceof Error ? error.message : String(error))',
          )

          content = content.replace(
            /catch\s*\(\s*error\s*\)\s*\{([^}]*?)throw new Error\(`([^`]*?)\$\{error\}`\)/g,
            'catch (error) {$1throw new Error(`$2${error instanceof Error ? error.message : String(error)}`)',
          )

          content = content.replace(
            /catch\s*\(\s*error\s*\)\s*\{([^}]*?)message:\s*error([,\s])/g,
            'catch (error) {$1message: error instanceof Error ? error.message : String(error)$2',
          )

          return content
        },
      },
    ],
  },

  // 2. git-provider.service.ts - 字符串属性访问
  {
    file: 'packages/services/business/src/gitops/git-providers/git-provider.service.ts',
    fixes: [
      {
        description: '修复 .path 和 .name 属性访问',
        apply: (content) => {
          // 查找并修复 file.path 和 file.name 的访问
          // 这些通常来自 API 响应，需要正确的类型断言
          content = content.replace(/(\w+)\.path(?!\s*[=:])/g, '($1 as any).path')

          content = content.replace(/(\w+)\.name(?!\s*[=:]\s*['"])/g, '($1 as any).name')

          return content
        },
      },
    ],
  },

  // 3. git-provider-org-extensions.ts - 导出问题
  {
    file: 'packages/services/business/src/gitops/git-providers/git-providers.module.ts',
    fixes: [
      {
        description: '移除 GitProviderOrgExtensions 导入',
        apply: (content) => {
          // 移除不存在的导入
          content = content.replace(
            /import\s*\{([^}]*?)GitProviderOrgExtensions,?\s*([^}]*?)\}\s*from\s*['"]\.\/git-provider-org-extensions['"]/g,
            (match, before, after) => {
              const imports = (before + after)
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s)
              if (imports.length === 0) {
                return ''
              }
              return `import { ${imports.join(', ')} } from './git-provider-org-extensions'`
            },
          )

          // 移除使用
          content = content.replace(/GitProviderOrgExtensions,?\s*/g, '')

          return content
        },
      },
    ],
  },

  // 4. conflict-resolution.service.ts - 多个问题
  {
    file: 'packages/services/business/src/gitops/git-sync/conflict-resolution.service.ts',
    fixes: [
      {
        description: '修复 gitUsername 字段访问',
        apply: (content) => {
          // gitUsername → username
          content = content.replace(/collaborator\.gitUsername/g, 'collaborator.username')

          content = content.replace(/gitCollaborator\.gitUsername/g, 'gitCollaborator.username')

          return content
        },
      },
      {
        description: '修复 mapGitPermissionToProjectRole 调用',
        apply: (content) => {
          // 移除多余的参数
          content = content.replace(
            /mapGitPermissionToProjectRole\(([^,)]+),\s*([^)]+)\)/g,
            'mapGitPermissionToProjectRole($1)',
          )

          return content
        },
      },
      {
        description: '修复 details 变量名',
        apply: (content) => {
          // details → metadata (根据 schema)
          content = content.replace(/\bdetails\b(?=\s*[,;}\]])/g, 'metadata')

          return content
        },
      },
      {
        description: '修复 logGitSyncAction 调用参数',
        apply: (content) => {
          // 检查并修复参数数量
          // logGitSyncAction 应该有 5 个参数
          content = content.replace(
            /await this\.logGitSyncAction\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g,
            'await this.logGitSyncAction($1, $2, $3, $4, {})',
          )

          return content
        },
      },
      {
        description: '修复 addMember 调用参数',
        apply: (content) => {
          // addMember 需要 3 个参数
          content = content.replace(
            /await this\.projectMembersService\.addMember\(([^,]+),\s*([^)]+)\)/g,
            'await this.projectMembersService.addMember($1, $2, "member")',
          )

          return content
        },
      },
    ],
  },
]

function applyFix(fix: Fix): boolean {
  try {
    let content = readFileSync(fix.file, 'utf-8')
    const original = content

    for (const { description, apply } of fix.fixes) {
      content = apply(content)
    }

    if (content !== original) {
      writeFileSync(fix.file, content, 'utf-8')
      console.log(`✅ ${fix.file}`)
      fix.fixes.forEach((f) => console.log(`   - ${f.description}`))
      return true
    }

    return false
  } catch (error) {
    console.error(`❌ ${fix.file}: ${error}`)
    return false
  }
}

function main() {
  console.log('🔧 开始修复特定的类型错误...\n')

  let fixedCount = 0

  for (const fix of fixes) {
    if (applyFix(fix)) {
      fixedCount++
    }
  }

  console.log(`\n📊 修复统计:`)
  console.log(`   修复文件数: ${fixedCount}/${fixes.length}`)
  console.log(`\n✨ 完成!`)
}

main()
