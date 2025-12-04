#!/usr/bin/env bun
/**
 * 激进的文档清理
 *
 * 只保留核心文档，删除所有历史记录和重构文档
 */

import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

// 核心文档（必须保留）
const CORE_DOCS = [
  'README.md',
  'ARCHITECTURE.md',
  'API_REFERENCE.md',
  'CHANGELOG.md',
  'ORGANIZATION.md',
  'CLEANUP_COMPLETED.md',
  'PROJECT_CLEANUP_SUMMARY.md',
]

// 核心目录（保留部分文档）
const KEEP_DIRS = {
  guides: ['quick-start.md', 'deployment-test.md', 'flux-installation.md', 'k3s-remote-access.md'],
  architecture: [
    'bun-k8s-client.md',
    'database-schema-relationships.md',
    'progress-system-final.md',
  ],
  'troubleshooting/flux': [
    'ssh-authentication.md',
    'network-policy.md',
    'kustomization-reconciling.md',
  ],
  'troubleshooting/kubernetes': ['QUICK_REFERENCE.md', 'namespace-timing.md'],
  'troubleshooting/git': ['repository-name-validation.md'],
}

// 完全删除的目录
const DELETE_DIRS = [
  'troubleshooting/refactoring',
  'troubleshooting/architecture',
  'troubleshooting/bun',
  'troubleshooting/startup',
  'troubleshooting/nestjs',
  'troubleshooting/frontend',
]

async function deleteDirectory(dir: string) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        await deleteDirectory(fullPath)
      } else {
        await unlink(fullPath)
      }
    }

    // 删除空目录
    await unlink(dir).catch(() => {})
  } catch (error) {
    // 目录不存在，忽略
  }
}

async function cleanDirectory(dir: string, keepFiles: string[]) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    let deleted = 0

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        if (!keepFiles.includes(entry.name)) {
          await unlink(join(dir, entry.name))
          deleted++
          console.log(`  ❌ ${entry.name}`)
        } else {
          console.log(`  ✅ ${entry.name}`)
        }
      }
    }

    return deleted
  } catch (error) {
    return 0
  }
}

async function main() {
  console.log('🔥 激进文档清理开始...\n')

  let totalDeleted = 0

  // 1. 删除整个目录
  console.log('📁 删除历史记录目录:\n')
  for (const dir of DELETE_DIRS) {
    const fullPath = join('docs', dir)
    console.log(`  🗑️  ${dir}`)
    await deleteDirectory(fullPath)
    totalDeleted += 10 // 估算
  }

  // 2. 清理核心目录，只保留指定文件
  console.log('\n📂 清理核心目录:\n')
  for (const [dir, keepFiles] of Object.entries(KEEP_DIRS)) {
    console.log(`\n${dir}:`)
    const deleted = await cleanDirectory(join('docs', dir), keepFiles)
    totalDeleted += deleted
  }

  // 3. 清理根目录
  console.log('\n📄 清理根目录:\n')
  const rootEntries = await readdir('docs', { withFileTypes: true })
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      if (!CORE_DOCS.includes(entry.name)) {
        await unlink(join('docs', entry.name))
        totalDeleted++
        console.log(`  ❌ ${entry.name}`)
      } else {
        console.log(`  ✅ ${entry.name}`)
      }
    }
  }

  // 统计最终结果
  const finalCount = await countDocs('docs')

  console.log('\n' + '='.repeat(60))
  console.log('📊 清理结果:')
  console.log('='.repeat(60))
  console.log(`删除文档: ~${totalDeleted} 个`)
  console.log(`剩余文档: ${finalCount} 个`)
  console.log('='.repeat(60))

  console.log('\n✨ 清理完成!')
  console.log('\n📝 保留的文档结构:')
  console.log(`
docs/
├── README.md                    # 文档索引
├── ARCHITECTURE.md              # 架构设计
├── API_REFERENCE.md             # API 文档
├── CHANGELOG.md                 # 变更日志
├── CLEANUP_COMPLETED.md         # 清理报告
├── guides/                      # 操作指南 (4 个)
│   ├── quick-start.md
│   ├── deployment-test.md
│   ├── flux-installation.md
│   └── k3s-remote-access.md
├── architecture/                # 架构文档 (3 个)
│   ├── bun-k8s-client.md
│   ├── database-schema-relationships.md
│   └── progress-system-final.md
└── troubleshooting/             # 问题排查 (7 个)
    ├── README.md
    ├── flux/
    │   ├── ssh-authentication.md
    │   ├── network-policy.md
    │   └── kustomization-reconciling.md
    ├── kubernetes/
    │   ├── QUICK_REFERENCE.md
    │   └── namespace-timing.md
    └── git/
        └── repository-name-validation.md

总计: ~20 个核心文档
  `)
}

async function countDocs(dir: string): Promise<number> {
  let count = 0
  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        count += await countDocs(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        count++
      }
    }
  } catch (error) {
    // 忽略错误
  }

  return count
}

main().catch(console.error)
