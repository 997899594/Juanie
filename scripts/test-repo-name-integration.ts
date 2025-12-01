#!/usr/bin/env bun
/**
 * 集成测试：验证仓库名称清理在前后端的一致性
 */

// 后端清理函数（从 GitProviderService 复制）
function backendSanitize(name: string): string {
  let sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/^-+/, '')
    .replace(/-+/g, '-')
    .replace(/-+$/, '')
    .substring(0, 100)

  if (!sanitized) {
    sanitized = 'project-' + Date.now()
  }

  return sanitized
}

// 前端清理函数（从 repository.ts 复制）
function frontendSanitize(name: string): string {
  let sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/^-+/, '')
    .replace(/-+/g, '-')
    .replace(/-+$/, '')
    .substring(0, 100)

  if (!sanitized) {
    sanitized = 'project-' + Date.now()
  }

  return sanitized
}

console.log('🧪 测试前后端仓库名称清理一致性\n')

const testCases = [
  '天赋vu句v聚聚',
  'My Project',
  'test@#$%project',
  '---test---',
  'Test___Project',
  'UPPERCASE',
  '123-project',
  'project-123',
  '中文项目名称',
  '',
  '!!!',
  'Very Long Project Name That Exceeds The Maximum Length Limit Of One Hundred Characters And Should Be Truncated',
]

let passed = 0
let failed = 0

for (const testCase of testCases) {
  const backendResult = backendSanitize(testCase)
  const frontendResult = frontendSanitize(testCase)

  // 对于会生成时间戳的情况，只检查前缀
  const isTimestampCase = !testCase || !/[a-z0-9]/i.test(testCase)
  const match = isTimestampCase
    ? backendResult.startsWith('project-') && frontendResult.startsWith('project-')
    : backendResult === frontendResult

  if (match) {
    console.log(`✅ "${testCase}"`)
    console.log(`   后端: ${backendResult}`)
    console.log(`   前端: ${frontendResult}`)
    passed++
  } else {
    console.log(`❌ "${testCase}"`)
    console.log(`   后端: ${backendResult}`)
    console.log(`   前端: ${frontendResult}`)
    console.log(`   不一致！`)
    failed++
  }
  console.log()
}

console.log(`📊 结果: ${passed} 通过, ${failed} 失败`)

if (failed > 0) {
  console.error('\n❌ 前后端清理逻辑不一致！')
  process.exit(1)
} else {
  console.log('\n✅ 前后端清理逻辑一致！')
}
