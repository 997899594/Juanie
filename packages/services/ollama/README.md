# @juanie/service-ollama

Ollama AI 服务包，提供本地 LLM 模型的集成。

## 功能

- 生成文本响应
- 流式响应
- 对话（带历史）
- 模型管理（列表、拉取、删除）
- 自动降级到模拟响应（当 Ollama 不可用时）

## 使用

```typescript
import { OllamaModule, OllamaService } from '@juanie/service-ollama'

// 在模块中导入
@Module({
  imports: [OllamaModule],
})
export class AppModule {}

// 使用服务
@Injectable()
export class MyService {
  constructor(private ollama: OllamaService) {}

  async generateText() {
    return await this.ollama.generate(
      'llama3.2:3b',
      'Hello, how are you?',
      'You are a helpful assistant'
    )
  }
}
```

## 环境变量

- `OLLAMA_HOST`: Ollama 服务地址（默认: `http://localhost:11434`）

## 推荐模型

- `llama3.2:3b` - 轻量级通用模型
- `codellama:7b` - 代码生成专用
- `mistral:7b` - 高质量通用模型
