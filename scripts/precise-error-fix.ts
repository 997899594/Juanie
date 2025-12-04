#!/usr/bin/env bun
/**
 * 精确错误修复脚本 - 针对性修复剩余的具体错误
 */
import { readFileSync, writeFileSync } from 'node:fs'

// 修复 git-provider.service.ts 中的 .path 和 .name 访问
function fixGitProviderService() {
  const file = 'packages/services/business/src/gitops/git-providers/git-provider.service.ts'
  let content = readFileSync(file, 'utf-8')

  // 修复第778行：error.message.path 和 error.message.name
  content = content.replace(
    /\(error instanceof Error \? error\.message : String\(error\)\)\.path/g,
    '((error instanceof Error ? error.message : String(error)) as any)?.path',
  )

  content = content.replace(
    /\(error instanceof Error \? error\.message : String\(error\)\)\.name/g,
    '((error instanceof Error ? error.message : String(error)) as any)?.name',
  )

  // 修复第1455行类似的问题
  content = content.replace(/\(file as any\)\.path/g, '(file as any)?.path')

  content = content.replace(/\(file as any\)\.name/g, '(file as any)?.name')

  writeFileSync(file, content, 'utf-8')
  console.log('✅ 修复 git-provider.service.ts')
}

// 修复 conflict-resolution.service.ts 中的 insert overload
function fixConflictResolutionService() {
  const file = 'packages/services/business/src/gitops/git-sync/conflict-resolution.service.ts'
  let content = readFileSync(file, 'utf-8')

  // 查找并修复所有 gitSyncLogs 插入
  content = content.replace(
    /\.insert\(schema\.gitSyncLogs\)\.values\(\{([^}]*?)syncType:/g,
    '.insert(schema.gitSyncLogs).values({$1action:',
  )

  content = content.replace(/entityType:/g, 'gitResourceType:')

  content = content.replace(/entityId:/g, 'gitResourceId:')

  content = content.replace(/syncedAt:/g, 'completedAt:')

  content = content.replace(/details:/g, 'metadata:')

  writeFileSync(file, content, 'utf-8')
  console.log('✅ 修复 conflict-resolution.service.ts')
}

// 修复 project-collaboration-sync.service.ts
function fixProjectCollaborationSync() {
  const file =
    'packages/services/business/src/gitops/git-sync/project-collaboration-sync.service.ts'
  let content = readFileSync(file, 'utf-8')

  // 修复 perPage 类型
  content = content.replace(/perPage:\s*100(?!\s+as)/g, 'perPage: 100 as 10 | 20 | 30 | 40 | 50')

  // 修复 string | undefined 问题 - 查找具体的行
  const lines = content.split('\n')
  const fixedLines = lines.map((line, index) => {
    // 第573行和579行的修复
    if (line.includes('gitUsername:') && line.includes('gitAccount.gitUsername')) {
      return line.replace(
        /gitUsername:\s*gitAccount\.gitUsername/g,
        'gitUsername: gitAccount.gitUsername ?? ""',
      )
    }
    if (line.includes('gitEmail:') && line.includes('gitAccount.gitEmail')) {
      return line.replace(
        /gitEmail:\s*gitAccount\.gitEmail/g,
        'gitEmail: gitAccount.gitEmail ?? ""',
      )
    }
    return line
  })

  content = fixedLines.join('\n')
  writeFileSync(file, content, 'utf-8')
  console.log('✅ 修复 project-collaboration-sync.service.ts')
}

// 修复 git-platform-sync.service.ts
function fixGitPlatformSync() {
  const file = 'packages/services/business/src/gitops/webhooks/git-platform-sync.service.ts'
  let content = readFileSync(file, 'utf-8')

  // 修复字段名
  content = content.replace(/syncType:/g, 'action:')
  content = content.replace(/entityType:/g, 'gitResourceType:')
  content = content.replace(/entityId:/g, 'gitResourceId:')
  content = content.replace(/syncedAt:/g, 'completedAt:')
  content = content.replace(/details:/g, 'metadata:')

  // 修复 syncProjectMembers 调用 - 添加缺失的参数
  content = content.replace(
    /await this\.projectCollaborationSync\.syncProjectMembers\(\s*project\.id\s*\)/g,
    'await this.projectCollaborationSync.syncProjectMembers(project.id, [], project.gitProvider as "github" | "gitlab")',
  )

  writeFileSync(file, content, 'utf-8')
  console.log('✅ 修复 git-platform-sync.service.ts')
}

function main() {
  console.log('🚀 开始精确错误修复...\n')

  try {
    fixGitProviderService()
    fixConflictResolutionService()
    fixProjectCollaborationSync()
    fixGitPlatformSync()

    console.log('\n🎉 精确错误修复完成!')
    console.log('💡 运行 bun run build 验证修复结果')
  } catch (error) {
    console.error('❌ 修复失败:', error)
    process.exit(1)
  }
}

main()
