# 提示词模板管理服务

提供提示词模板的 CRUD 操作和模板渲染功能。

## 功能

- **创建模板**: 创建新的提示词模板
- **查询模板**: 根据 ID 或分类查询模板
- **更新模板**: 更新现有模板
- **删除模板**: 删除模板
- **渲染模板**: 将模板中的变量占位符替换为实际值

## 使用示例

### 创建模板

```typescript
import { PromptService } from '@juanie/service-extensions'

const promptService = new PromptService(db)

const template = await promptService.create({
  organizationId: 'org-123',
  name: '代码审查模板',
  category: 'code-review',
  template: '请审查以下 {{language}} 代码:\n\n{{code}}\n\n关注点: {{focus}}',
  variables: ['language', 'code', 'focus'],
  isActive: true,
})
```

### 查询模板

```typescript
// 根据 ID 查询
const template = await promptService.findById('template-id')

// 根据分类查询
const codeReviewTemplates = await promptService.findByCategory('code-review')
```

### 渲染模板

```typescript
const rendered = await promptService.render('template-id', {
  language: 'TypeScript',
  code: 'const x = 1',
  focus: '类型安全',
})

// 输出:
// 请审查以下 TypeScript 代码:
//
// const x = 1
//
// 关注点: 类型安全
```

### 更新模板

```typescript
await promptService.update('template-id', {
  template: '更新后的模板内容',
  variables: ['new', 'variables'],
})
```

### 删除模板

```typescript
await promptService.delete('template-id')
```

## 模板分类

支持以下预定义分类:

- `code-review`: 代码审查
- `config-gen`: 配置生成
- `troubleshooting`: 故障诊断
- `general`: 通用模板

## 变量替换

模板使用 `{{variable}}` 语法定义变量占位符。渲染时,所有匹配的占位符都会被替换为提供的值。

示例:

```typescript
template: 'Hello {{name}}, welcome to {{project}}!'
variables: { name: 'Alice', project: 'AI Platform' }
// 结果: 'Hello Alice, welcome to AI Platform!'
```

## 使用计数

每次调用 `render` 方法时,模板的 `usageCount` 会自动增加 1,用于统计模板使用频率。

## 错误处理

所有方法在失败时都会抛出 `AppError`,包含详细的错误信息:

```typescript
try {
  await promptService.render('invalid-id', {})
} catch (error) {
  // error.code: 'AI_INFERENCE_FAILED'
  // error.message: 'Template invalid-id not found'
}
```

## 数据库 Schema

模板存储在 `prompt_templates` 表中:

```sql
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  template TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## 集成

`PromptService` 已在 `AIModule` 中注册,可以通过依赖注入使用:

```typescript
import { Injectable } from '@nestjs/common'
import { PromptService } from '@juanie/service-extensions'

@Injectable()
export class MyService {
  constructor(private promptService: PromptService) {}

  async useTemplate() {
    const rendered = await this.promptService.render('template-id', {
      variable: 'value',
    })
    return rendered
  }
}
```
