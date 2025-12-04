#!/usr/bin/env bun
/**
 * 完整的 Schema 对齐修复脚本
 * 以数据库 Schema 为权威标准，系统性修复所有不一致
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function* walkFiles(dir: string, pattern: RegExp): Generator<string> {
  const files = readdirSync(dir)
  for (const file of files) {
    const path = join(dir, file)
    try {
      const stat = statSync(path)
      if (stat.isDirectory()) {
        if (!file.includes('node_modules') && !file.includes('dist') && !file.includes('.git')) {
          yield* walkFiles(path, pattern)
        }
      } else if (pattern.test(file)) {
        yield path
      }
    } catch (e) {
      // Skip files we can't access
    }
  }
}

function fixFile(filePath: string): { fixed: boolean; changes: string[] } {
  let content = readFileSync(filePath, 'utf-8')
  const original = content
  const changes: string[] = []

  // 1. Projects Schema 修复
  if (
    content.includes('schema.projects.gitRepoId') ||
    content.includes('schema.projects.gitRepositoryId')
  ) {
    content = content.replace(/schema\.projects\.gitRepoId/g, 'schema.projects.gitRepoUrl')
    content = content.replace(/schema\.projects\.gitRepositoryId/g, 'schema.projects.gitRepoUrl')
    changes.push('projects.gitRepoId → gitRepoUrl')
  }

  if (content.includes('project.createdBy')) {
    content = content.replace(/project\.createdBy/g, 'project.organizationId')
    changes.push('project.createdBy → organizationId')
  }

  if (content.includes('gitRepoId:')) {
    content = content.replace(/gitRepoId:/g, 'gitRepoUrl:')
    changes.push('gitRepoId: → gitRepoUrl:')
  }

  // 2. Git Sync Logs Schema 修复
  if (content.includes('entityType:') || content.includes('entityId:')) {
    content = content.replace(/entityType:/g, 'gitResourceType:')
    content = content.replace(/entityId:/g, 'gitResourceId:')
    content = content.replace(
      /schema\.gitSyncLogs\.entityType/g,
      'schema.gitSyncLogs.gitResourceType',
    )
    content = content.replace(/schema\.gitSyncLogs\.entityId/g, 'schema.gitSyncLogs.gitResourceId')
    changes.push('entityType/entityId → gitResourceType/gitResourceId')
  }

  if (content.includes('syncedAt:')) {
    content = content.replace(/syncedAt:/g, 'completedAt:')
    content = content.replace(/schema\.gitSyncLogs\.syncedAt/g, 'schema.gitSyncLogs.completedAt')
    changes.push('syncedAt → completedAt')
  }

  if (content.includes('details:') && content.includes('gitSyncLogs')) {
    content = content.replace(/details:/g, 'metadata:')
    changes.push('details → metadata')
  }

  // 3. User Git Accounts Schema 修复
  if (content.includes('.gitLogin') || content.includes('gitLogin:')) {
    content = content.replace(/\.gitLogin\b/g, '.gitUsername')
    content = content.replace(/gitLogin:/g, 'gitUsername:')
    content = content.replace(/collaborator\.gitLogin/g, 'collaborator.username')
    content = content.replace(/event\.collaborator\.gitLogin/g, 'event.collaborator.username')
    changes.push('gitLogin → gitUsername')
  }

  if (content.includes('.gitName')) {
    content = content.replace(/\.gitName\b/g, '.gitUsername')
    content = content.replace(/collaborator\.gitName/g, 'collaborator.username')
    changes.push('gitName → gitUsername')
  }

  // 4. Users Schema 修复
  if (content.includes('user.name') && !content.includes('user.username')) {
    content = content.replace(/user\.name\b/g, 'user.displayName')
    content = content.replace(/member\.name\b/g, 'member.displayName')
    changes.push('user.name → displayName')
  }

  // 5. Event Repository 修复 - 需要添加 url 字段到事件类型
  if (content.includes('event.repository.gitId') && !content.includes('event.repository.url')) {
    // 这个需要检查实际的事件类型定义
    changes.push('⚠️  event.repository 需要手动检查')
  }

  // 6. Project Members Schema 修复
  if (content.includes('invitedAt:') && content.includes('projectMembers')) {
    content = content.replace(/invitedAt:/g, 'joinedAt:')
    changes.push('invitedAt → joinedAt')
  }

  // 7. 方法调用修复
  if (content.includes('.getCredential(')) {
    content = content.replace(/\.getCredential\(/g, '.getCredentials(')
    changes.push('getCredential → getCredentials')
  }

  if (content.includes('.queueOrganizationSync(')) {
    content = content.replace(/\.queueOrganizationSync\(/g, '.syncOrganization(')
    changes.push('queueOrganizationSync → syncOrganization')
  }

  if (content.includes('.queueMemberSync(')) {
    content = content.replace(/\.queueMemberSync\(/g, '.syncMember(')
    changes.push('queueMemberSync → syncMember')
  }

  // 8. HealthStatus 修复
  if (content.includes("status: 'healthy'") || content.includes("status: 'unhealthy'")) {
    content = content.replace(/status: 'healthy'/g, 'isHealthy: true')
    content = content.replace(/status: 'unhealthy'/g, 'isHealthy: false')
    content = content.replace(/message:/g, 'error:')
    content = content.replace(/health\.status === 'healthy'/g, 'health.isHealthy')
    content = content.replace(/health\.status === 'unhealthy'/g, '!health.isHealthy')
    content = content.replace(/health\.message/g, 'health.error')
    changes.push('HealthStatus 接口修复')
  }

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8')
    return { fixed: true, changes }
  }

  return { fixed: false, changes: [] }
}

function main() {
  console.log('🔧 开始完整的 Schema 对齐修复...\n')

  const dirs = ['packages/services/business/src/gitops', 'packages/services/business/src/projects']

  let fixedCount = 0
  const fileChanges: Record<string, string[]> = {}

  for (const dir of dirs) {
    for (const file of walkFiles(dir, /\.ts$/)) {
      if (file.includes('.spec.ts') || file.includes('.test.ts')) {
        continue // 跳过测试文件
      }

      const result = fixFile(file)
      if (result.fixed) {
        fixedCount++
        fileChanges[file] = result.changes
        console.log(`✅ ${file}`)
        result.changes.forEach((change) => console.log(`   - ${change}`))
      }
    }
  }

  console.log(`\n📊 修复统计:`)
  console.log(`   修复文件数: ${fixedCount}`)
  console.log(`   总变更类型: ${Object.values(fileChanges).flat().length}`)

  if (fixedCount > 0) {
    console.log(`\n⚠️  需要手动检查的问题:`)
    console.log(`   1. event.repository 的实际结构`)
    console.log(`   2. 方法参数数量不匹配`)
    console.log(`   3. 复杂的类型转换`)
  }

  console.log(`\n✨ 完成!`)
}

main()
