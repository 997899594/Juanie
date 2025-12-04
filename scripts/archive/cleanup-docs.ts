#!/usr/bin/env bun
/**
 * 整理文档
 *
 * 分析 docs/ 目录，识别过时、重复、临时的文档
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

interface DocInfo {
  path: string
  name: string
  size: number
  category: 'keep' | 'archive' | 'delete'
  reason: string
}

// 核心文档（必须保留）
const CORE_DOCS = [
  'README.md',
  'ARCHITECTURE.md',
  'API_REFERENCE.md',
  'CHANGELOG.md',
  'ORGANIZATION.md',
]

// 临时文档模式（应该删除或归档）
const TEMP_PATTERNS = [
  /FIXES?_SUMMARY/i,
  /PROGRESS_SUMMARY/i,
  /STATUS\.md$/i,
  /QUICK_FIX/i,
  /REAL_FIX/i,
  /MANUAL_FIX/i,
  /-fix\.md$/i,
  /-summary\.md$/i,
  /-complete\.md$/i,
  /-checkpoint/i,
]

async function findAllDocs(dir: string, basePath = ''): Promise<string[]> {
  const docs: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const relativePath = basePath ? join(basePath, entry.name) : entry.name

    if (entry.isDirectory()) {
      const subDocs = await findAllDocs(fullPath, relativePath)
      docs.push(...subDocs)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      docs.push(relativePath)
    }
  }

  return docs
}

async function analyzeDoc(docPath: string): Promise<DocInfo> {
  const fullPath = join('docs', docPath)
  const stats = await stat(fullPath)
  const name = docPath.split('/').pop() || docPath

  // 核心文档
  if (CORE_DOCS.includes(name)) {
    return {
      path: docPath,
      name,
      size: stats.size,
      category: 'keep',
      reason: '核心文档',
    }
  }

  // 检查是否是临时文档
  const isTemp = TEMP_PATTERNS.some((pattern) => pattern.test(name))
  if (isTemp) {
    return {
      path: docPath,
      name,
      size: stats.size,
      category: 'delete',
      reason: '临时文档',
    }
  }

  // 检查文档大小（太小可能是空文档）
  if (stats.size < 100) {
    return {
      path: docPath,
      name,
      size: stats.size,
      category: 'delete',
      reason: '空文档',
    }
  }

  // guides/ 和 architecture/ 目录的文档保留
  if (docPath.startsWith('guides/') || docPath.startsWith('architecture/')) {
    return {
      path: docPath,
      name,
      size: stats.size,
      category: 'keep',
      reason: '指南/架构文档',
    }
  }

  // troubleshooting/ 目录的文档归档
  if (docPath.startsWith('troubleshooting/')) {
    // 检查是否是重复的修复文档
    if (/-fix-\d+\.md$/.test(name) || /task\d+-complete/.test(name)) {
      return {
        path: docPath,
        name,
        size: stats.size,
        category: 'archive',
        reason: '历史修复记录',
      }
    }

    return {
      path: docPath,
      name,
      size: stats.size,
      category: 'keep',
      reason: '问题排查文档',
    }
  }

  // 其他文档默认保留
  return {
    path: docPath,
    name,
    size: stats.size,
    category: 'keep',
    reason: '其他文档',
  }
}

async function main() {
  console.log('🔍 分析 docs/ 目录...\n')

  const allDocs = await findAllDocs('docs')
  const analyzed: DocInfo[] = []

  for (const doc of allDocs) {
    const info = await analyzeDoc(doc)
    analyzed.push(info)
  }

  // 分组统计
  const toKeep = analyzed.filter((d) => d.category === 'keep')
  const toArchive = analyzed.filter((d) => d.category === 'archive')
  const toDelete = analyzed.filter((d) => d.category === 'delete')

  console.log('✅ 保留的文档 (%d 个):\n', toKeep.length)
  const keepByReason = new Map<string, DocInfo[]>()
  for (const doc of toKeep) {
    if (!keepByReason.has(doc.reason)) {
      keepByReason.set(doc.reason, [])
    }
    keepByReason.get(doc.reason)!.push(doc)
  }
  for (const [reason, docs] of keepByReason) {
    console.log(`  ${reason} (${docs.length} 个)`)
  }

  console.log('\n📦 建议归档的文档 (%d 个):\n', toArchive.length)
  for (const doc of toArchive.slice(0, 10)) {
    const sizeKB = (doc.size / 1024).toFixed(1)
    console.log(`  ${doc.path.padEnd(60)} ${sizeKB.padStart(6)} KB`)
  }
  if (toArchive.length > 10) {
    console.log(`  ... 还有 ${toArchive.length - 10} 个`)
  }

  console.log('\n❌ 建议删除的文档 (%d 个):\n', toDelete.length)
  for (const doc of toDelete.slice(0, 15)) {
    const sizeKB = (doc.size / 1024).toFixed(1)
    console.log(`  ${doc.path.padEnd(60)} ${sizeKB.padStart(6)} KB  (${doc.reason})`)
  }
  if (toDelete.length > 15) {
    console.log(`  ... 还有 ${toDelete.length - 15} 个`)
  }

  // 统计
  const totalSize = analyzed.reduce((sum, d) => sum + d.size, 0)
  const deleteSize = toDelete.reduce((sum, d) => sum + d.size, 0)
  const archiveSize = toArchive.reduce((sum, d) => sum + d.size, 0)

  console.log('\n📊 统计:')
  console.log(`  总文档数: ${analyzed.length}`)
  console.log(`  保留: ${toKeep.length}`)
  console.log(`  归档: ${toArchive.length}`)
  console.log(`  删除: ${toDelete.length}`)
  console.log(`  总大小: ${(totalSize / 1024).toFixed(1)} KB`)
  console.log(`  可节省: ${((deleteSize + archiveSize) / 1024).toFixed(1)} KB`)

  console.log('\n💡 建议:')
  console.log('  1. 删除临时文档和空文档')
  console.log('  2. 将历史修复记录归档到 docs/archive/')
  console.log('  3. 整合重复的文档')
  console.log('  4. 更新 docs/README.md 作为文档索引')

  console.log('\n📝 核心文档结构建议:')
  console.log(`
docs/
├── README.md                    # 文档索引
├── ARCHITECTURE.md              # 架构设计
├── API_REFERENCE.md             # API 文档
├── CHANGELOG.md                 # 变更日志
├── guides/                      # 操作指南
│   ├── quick-start.md
│   ├── deployment.md
│   └── development.md
├── architecture/                # 架构文档
│   ├── overview.md
│   ├── gitops.md
│   └── database.md
├── troubleshooting/             # 问题排查
│   ├── README.md
│   ├── flux/
│   ├── kubernetes/
│   └── git/
└── archive/                     # 历史文档
    └── 2024-12/
  `)
}

main().catch(console.error)
