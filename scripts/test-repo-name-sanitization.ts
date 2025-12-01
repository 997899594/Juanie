#!/usr/bin/env bun
/**
 * 测试仓库名称清理功能
 */

// 模拟清理函数（与 GitProviderService 中的实现相同）
function sanitizeRepositoryName(name: string): string {
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

// 测试用例
const testCases = [
  { input: '天赋vu句v聚聚', expected: 'vu-v' },
  { input: 'My Project', expected: 'my-project' },
  { input: 'test@#$%project', expected: 'test-project' },
  { input: '---test---', expected: 'test' },
  { input: 'Test___Project', expected: 'test___project' },
  { input: 'UPPERCASE', expected: 'uppercase' },
  { input: '123-project', expected: '123-project' },
  { input: 'project-123', expected: 'project-123' },
  { input: '中文项目名称', expected: 'project-' + Date.now() }, // 会生成默认名称
  { input: '', expected: 'project-' + Date.now() },
  { input: '!!!', expected: 'project-' + Date.now() },
]

console.log('🧪 测试仓库名称清理功能\n')

let passed = 0
let failed = 0

for (const testCase of testCases) {
  const result = sanitizeRepositoryName(testCase.input)
  const isValid = /^[a-z0-9][a-z0-9-_]*$/.test(result)

  // 对于会生成默认名称的情况，只检查格式是否正确
  const shouldGenerateDefault = testCase.expected.startsWith('project-')
  const success = shouldGenerateDefault
    ? result.startsWith('project-') && isValid
    : result === testCase.expected && isValid

  if (success) {
    console.log(`✅ "${testCase.input}" -> "${result}"`)
    passed++
  } else {
    console.log(`❌ "${testCase.input}" -> "${result}" (expected: ${testCase.expected})`)
    failed++
  }
}

console.log(`\n📊 结果: ${passed} 通过, ${failed} 失败`)

if (failed > 0) {
  process.exit(1)
}
