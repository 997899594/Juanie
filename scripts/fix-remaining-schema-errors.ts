#!/usr/bin/env bun
/**
 * 修复剩余的 Schema 字段不匹配问题
 * 以数据库 Schema 为准，修复业务代码
 */

import { readFileSync, writeFileSync } from 'node:fs'

const filesToFix = [
  'packages/services/business/src/gitops/webhooks/git-platform-sync.service.ts',
  'packages/services/business/src/gitops/webhooks/webhook.controller.ts',
  'packages/services/business/src/index.ts',
]

function fixFile(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, 'utf-8')
    const original = content

    // 1. 修复 projects schema: gitRepoId → gitRepositoryId
    content = content.replace(/schema\.projects\.gitRepoId/g, 'schema.projects.gitRepositoryId')
    content = content.replace(
      /eq\(schema\.projects\.gitRepoId,/g,
      'eq(schema.projects.gitRepositoryId,',
    )

    // 2. 修复 projects schema: createdBy → organizationId
    content = content.replace(/project\.createdBy/g, 'project.organizationId')
    content = content.replace(
      /removedBy: project\.organizationId/g,
      'removedBy: project.organizationId',
    )

    // 3. 修复 git-sync-logs schema 字段
    content = content.replace(/entityType:/g, 'resourceType:')
    content = content.replace(/entityId:/g, 'resourceId:')
    content = content.replace(/syncedAt:/g, 'completedAt:')

    // 4. 修复 undefined 参数问题
    content = content.replace(
      /await this\.webhookService\.handleGitHubWebhook\(payload, signature\)/g,
      "await this.webhookService.handleGitHubWebhook(payload, signature || '')",
    )

    // 5. 修复导出问题 - 移除不存在的导出
    if (filePath.includes('index.ts')) {
      content = content.replace(
        /export \{ mapGitPermissionToProjectRole \} from '\.\/gitops\/git-sync\/permission-mapper'/g,
        '// mapGitPermissionToProjectRole 已在 permission-mapper.ts 中导出',
      )
    }

    if (content !== original) {
      writeFileSync(filePath, content, 'utf-8')
      console.log(`✅ 修复: ${filePath}`)
      return true
    }

    return false
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error)
    return false
  }
}

function main() {
  console.log('🔧 开始修复剩余的 Schema 不匹配问题...\n')

  let fixedCount = 0

  for (const file of filesToFix) {
    if (fixFile(file)) {
      fixedCount++
    }
  }

  console.log(`\n✨ 完成! 修复了 ${fixedCount} 个文件`)
}

main()
