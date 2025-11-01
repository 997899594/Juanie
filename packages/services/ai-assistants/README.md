# @juanie/service-ai-assistants

AI 助手服务包，提供 AI 助手的创建、管理和对话功能。

## 功能

- 创建和管理 AI 助手
- 支持多种 AI 提供商（Ollama、OpenAI、Anthropic、Google）
- 与助手对话（支持流式响应）
- 助手评分和使用统计
- 组织级权限控制

## 助手类型

- `code-reviewer` - 代码审查助手
- `devops-engineer` - DevOps 工程师助手
- `cost-optimizer` - 成本优化助手

## 使用

```typescript
import { AiAssistantsModule, AiAssistantsService } from '@juanie/service-ai-assistants'

// 在模块中导入
@Module({
  imports: [AiAssistantsModule],
})
export class AppModule {}

// 使用服务
@Injectable()
export class MyService {
  constructor(private aiAssistants: AiAssistantsService) {}

  async createAssistant() {
    return await this.aiAssistants.create(userId, {
      name: 'My Code Reviewer',
      type: 'code-reviewer',
      modelConfig: {
        provider: 'ollama',
        model: 'codellama:7b',
        temperature: 0.7,
      },
      systemPrompt: 'You are a helpful code reviewer...',
    })
  }

  async chat() {
    return await this.aiAssistants.chat(userId, assistantId, {
      message: 'Review this code...',
    })
  }
}
```

## 依赖

- `@juanie/core-database` - 数据库访问
- `@juanie/service-ollama` - Ollama AI 服务
- `@juanie/core-observability` - 可观测性追踪
