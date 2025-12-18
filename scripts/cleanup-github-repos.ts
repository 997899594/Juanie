#!/usr/bin/env bun

/**
 * 批量删除 GitHub 测试仓库
 *
 * 使用方法：
 * 1. 设置环境变量 GITHUB_TOKEN
 * 2. bun run scripts/cleanup-github-repos.ts
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_USERNAME = '997899594' // 你的 GitHub 用户名

if (!GITHUB_TOKEN) {
  console.error('❌ 请设置 GITHUB_TOKEN 环境变量')
  process.exit(1)
}

interface Repository {
  name: string
  full_name: string
  created_at: string
  private: boolean
}

async function listRepositories(): Promise<Repository[]> {
  const response = await fetch(
    `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=created&direction=desc`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to list repositories: ${response.statusText}`)
  }

  return response.json()
}

async function deleteRepository(fullName: string): Promise<boolean> {
  const response = await fetch(`https://api.github.com/repos/${fullName}`, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  return response.status === 204
}

async function main() {
  console.log('🔍 获取仓库列表...\n')

  const repos = await listRepositories()

  // 过滤测试仓库 - 只匹配纯数字命名的仓库（更安全）
  const testRepos = repos.filter((repo) => {
    // 只匹配纯数字命名的测试仓库，避免误删开源项目
    return /^\d+$/.test(repo.name)
  })

  if (testRepos.length === 0) {
    console.log('✅ 没有找到测试仓库（纯数字命名）')
    return
  }

  console.log(`找到 ${testRepos.length} 个测试仓库（纯数字命名）：\n`)

  testRepos.forEach((repo, index) => {
    console.log(
      `${index + 1}. ${repo.name} (${repo.private ? '私有' : '公开'}) - 创建于 ${new Date(repo.created_at).toLocaleDateString('zh-CN')}`,
    )
  })

  console.log('\n⚠️  请仔细检查以上列表，确认都是测试仓库！')
  console.log('⚠️  按 Ctrl+C 取消，或等待 10 秒后自动开始删除...\n')

  await new Promise((resolve) => setTimeout(resolve, 10000))

  console.log('🗑️  开始删除...\n')

  let successCount = 0
  let failCount = 0

  for (const repo of testRepos) {
    try {
      const success = await deleteRepository(repo.full_name)
      if (success) {
        console.log(`✅ 已删除: ${repo.name}`)
        successCount++
      } else {
        console.log(`❌ 删除失败: ${repo.name}`)
        failCount++
      }
      // 避免触发 GitHub API 限流
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`❌ 删除失败: ${repo.name} - ${error}`)
      failCount++
    }
  }

  console.log(`\n📊 删除完成: 成功 ${successCount} 个，失败 ${failCount} 个`)
}

main().catch(console.error)
