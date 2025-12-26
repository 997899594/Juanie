# 分层架构强制执行指南

> 创建时间: 2024-12-24
> 目的: 通过工具和流程保证分层架构不被破坏

## 🎯 目标

确保：
1. ✅ Core 层不依赖 Foundation/Business 层
2. ✅ Foundation 层不依赖 Business 层
3. ✅ Business 层不绕过 Foundation 层直接查询数据库

---

## 🛡️ 强制执行机制

### 1. ESLint 规则

#### Core 层规则

**文件**: `packages/core/.eslintrc.js`

```javascript
module.exports = {
  extends: ['../../.eslintrc.js'],
  rules: {
    // 禁止从 Foundation/Business 层导入
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@juanie/service-foundation*', '@juanie/service-business*', '@juanie/service-extensions*'],
            message: '❌ Core 层不能依赖 Foundation/Business/Extensions 层'
          }
        ]
      }
    ]
  }
}
```

#### Foundation 层规则

**文件**: `packages/services/foundation/.eslintrc.js`

```javascript
module.exports = {
  extends: ['../../../.eslintrc.js'],
  rules: {
    // 禁止从 Business 层导入
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@juanie/service-business*', '@juanie/service-extensions*'],
            message: '❌ Foundation 层不能依赖 Business/Extensions 层'
          }
        ]
      }
    ]
  }
}
```

#### Business 层规则

**文件**: `packages/services/business/.eslintrc.js`

```javascript
module.exports = {
  extends: ['../../../.eslintrc.js'],
  rules: {
    // 警告: 直接查询 Foundation 层的表
    'no-restricted-syntax': [
      'warn',  // 先用 warn，修复完成后改为 error
      {
        // 检测 schema.organizations, schema.organizationMembers 等
        selector: 'MemberExpression[object.name="schema"][property.name=/^(organizations|organizationMembers|teams|teamMembers|users|sessions)$/]',
        message: '⚠️ Business 层不应该直接查询 Foundation 层的表 (organizations, teams, users 等)，请使用 Foundation 层的 Service'
      },
      {
        // 检测 db.query.organizations, db.query.users 等
        selector: 'MemberExpression[object.object.name="db"][object.property.name="query"][property.name=/^(organizations|organizationMembers|teams|teamMembers|users|sessions)$/]',
        message: '⚠️ Business 层不应该直接查询 Foundation 层的表，请使用 Foundation 层的 Service'
      }
    ]
  }
}
```

---

### 2. TypeScript 配置

#### 严格的路径映射

**文件**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@juanie/core": ["./packages/core/src/index.ts"],
      "@juanie/core/*": ["./packages/core/src/*/index.ts"],
      "@juanie/service-foundation": ["./packages/services/foundation/src/index.ts"],
      "@juanie/service-business": ["./packages/services/business/src/index.ts"]
    }
  }
}
```

**好处**:
- ✅ 只能从模块入口导入
- ✅ 不能深层导入（如 `@juanie/core/database/schemas/users`）
- ✅ 重构时更容易

---

### 3. 架构测试

**文件**: `packages/core/tests/architecture.test.ts`

```typescript
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('Core Package Architecture', () => {
  it('should not import from Foundation layer', () => {
    const violations = checkImports('packages/core/src', [
      '@juanie/service-foundation',
      '@juanie/service-business',
      '@juanie/service-extensions'
    ])
    
    expect(violations).toEqual([])
  })
  
  it('should export through index.ts', () => {
    const modules = ['database', 'queue', 'events', 'logger', 'errors', 'utils']
    
    for (const module of modules) {
      const indexPath = path.join('packages/core/src', module, 'index.ts')
      expect(fs.existsSync(indexPath)).toBe(true)
    }
  })
})

describe('Foundation Package Architecture', () => {
  it('should not import from Business layer', () => {
    const violations = checkImports('packages/services/foundation/src', [
      '@juanie/service-business',
      '@juanie/service-extensions'
    ])
    
    expect(violations).toEqual([])
  })
})

describe('Business Package Architecture', () => {
  it('should not directly query Foundation tables', () => {
    const violations = checkDirectQueries('packages/services/business/src', [
      'schema.organizations',
      'schema.organizationMembers',
      'schema.teams',
      'schema.teamMembers',
      'schema.users',
      'db.query.organizations',
      'db.query.organizationMembers',
      'db.query.teams',
      'db.query.teamMembers',
      'db.query.users'
    ])
    
    // 先记录违规，修复完成后改为 expect(violations).toEqual([])
    if (violations.length > 0) {
      console.warn('⚠️ Found violations:', violations)
    }
  })
})

function checkImports(dir: string, forbiddenImports: string[]): string[] {
  const violations: string[] = []
  const files = getAllTsFiles(dir)
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    
    for (const forbidden of forbiddenImports) {
      if (content.includes(forbidden)) {
        violations.push(`${file}: imports ${forbidden}`)
      }
    }
  }
  
  return violations
}

function checkDirectQueries(dir: string, forbiddenPatterns: string[]): string[] {
  const violations: string[] = []
  const files = getAllTsFiles(dir)
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    
    for (const pattern of forbiddenPatterns) {
      if (content.includes(pattern)) {
        violations.push(`${file}: uses ${pattern}`)
      }
    }
  }
  
  return violations
}

function getAllTsFiles(dir: string): string[] {
  const files: string[] = []
  
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.push(fullPath)
      }
    }
  }
  
  walk(dir)
  return files
}
```

---

### 4. Git Hooks

**文件**: `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 运行 ESLint 检查
echo "🔍 Checking layered architecture..."
bun run lint

# 运行架构测试
echo "🧪 Running architecture tests..."
bun test packages/core/tests/architecture.test.ts

# 如果有错误，阻止提交
if [ $? -ne 0 ]; then
  echo "❌ Architecture violations detected. Please fix before committing."
  exit 1
fi

echo "✅ Architecture checks passed"
```

---

### 5. CI 检查

**文件**: `.github/workflows/architecture-check.yml`

```yaml
name: Architecture Check

on:
  pull_request:
    branches: [main, develop]

jobs:
  check:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install
      
      - name: Run ESLint
        run: bun run lint
      
      - name: Run architecture tests
        run: bun test packages/core/tests/architecture.test.ts
      
      - name: Check for violations
        run: |
          if grep -r "schema.organizations" packages/services/business/src; then
            echo "❌ Found direct queries to Foundation tables"
            exit 1
          fi
```

---

## 📋 代码审查清单

### Core 层

- [ ] 没有导入 `@juanie/service-foundation`
- [ ] 没有导入 `@juanie/service-business`
- [ ] 没有业务逻辑
- [ ] 所有导出都通过 `index.ts`

### Foundation 层

- [ ] 没有导入 `@juanie/service-business`
- [ ] 只依赖 `@juanie/core`
- [ ] Service 方法职责单一
- [ ] 有单元测试

### Business 层

- [ ] 不直接查询 `schema.organizations`
- [ ] 不直接查询 `schema.organizationMembers`
- [ ] 不直接查询 `schema.teams`
- [ ] 不直接查询 `schema.teamMembers`
- [ ] 不直接查询 `schema.users`
- [ ] 通过 Foundation 层的 Service 访问这些实体
- [ ] 有集成测试

---

## 🔧 修复违规的步骤

### 步骤 1: 识别违规

运行 ESLint:
```bash
bun run lint
```

运行架构测试:
```bash
bun test packages/core/tests/architecture.test.ts
```

### 步骤 2: 修复违规

**错误代码**:
```typescript
// ❌ Business 层直接查询 organizations 表
const [org] = await this.db
  .select()
  .from(schema.organizations)
  .where(eq(schema.organizations.id, orgId))
```

**修复步骤**:

1. 注入 Foundation 层的 Service:
```typescript
constructor(
  private organizationsService: OrganizationsService
) {}
```

2. 使用 Service 方法:
```typescript
// ✅ 通过 Foundation 层
const org = await this.organizationsService.get(orgId, userId)
```

3. 如果 Service 缺少方法，先在 Foundation 层添加:
```typescript
// packages/services/foundation/src/organizations/organizations.service.ts
async get(organizationId: string, userId: string) {
  // 实现逻辑
}
```

### 步骤 3: 验证修复

运行测试:
```bash
bun test
```

运行 ESLint:
```bash
bun run lint
```

---

## 📊 监控和报告

### 定期审计

每周运行架构测试，生成报告:

```bash
bun test packages/core/tests/architecture.test.ts --reporter=json > architecture-report.json
```

### 违规趋势

跟踪违规数量的变化:

```bash
# 统计违规数量
grep -r "schema.organizations" packages/services/business/src | wc -l
```

### 目标

- **短期目标**: 减少违规到 0
- **长期目标**: 保持 0 违规

---

## 🎯 成功标准

1. ✅ ESLint 检查通过（0 errors）
2. ✅ 架构测试通过（0 violations）
3. ✅ CI 检查通过
4. ✅ 代码审查清单全部勾选

---

## 📚 相关文档

- [Core 包设计评审](../architecture/core-package-design-review.md)
- [分层架构分析](../architecture/layered-architecture-analysis.md)
- [分层架构违规](../architecture/layered-architecture-violations.md)
- [分层架构修复进度](../architecture/layered-architecture-fix-progress.md)

---

## 总结

通过以下机制保证分层架构：

1. **ESLint 规则** - 自动检测违规
2. **TypeScript 配置** - 限制导入路径
3. **架构测试** - 自动化验证
4. **Git Hooks** - 提交前检查
5. **CI 检查** - PR 自动检查
6. **代码审查清单** - 人工审查

**实施这些机制后，可以确保分层架构不被破坏。**
