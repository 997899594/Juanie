# 🤖 Ollama AI 服务使用指南

## ✅ 已完成的功能

1. **Ollama 集成** - 本地 LLM 支持
2. **AI 对话** - 完整的对话功能
3. **流式响应** - 实时打字效果
4. **模型管理** - 列出和检查可用模型
5. **多种 AI 助手** - 代码审查、DevOps、成本优化

---

## 🚀 快速开始

### 1. 安装 Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# 或者访问 https://ollama.com/download 下载安装包
```

### 2. 拉取推荐模型

```bash
# 轻量级模型（3B 参数，推荐）
ollama pull llama3.2:3b

# 代码专用模型
ollama pull codellama:7b

# 通用模型（更强大）
ollama pull llama3.2:latest

# 中文优化模型
ollama pull qwen2.5:7b
```

### 3. 启动 Ollama 服务

```bash
# Ollama 会自动在后台运行
# 验证服务
curl http://localhost:11434/api/tags

# 或者测试对话
ollama run llama3.2:3b
```

### 4. 配置环境变量

```bash
# .env 文件已经配置好了
OLLAMA_HOST=http://localhost:11434
```

### 5. 启动应用

```bash
bun run dev
```

---

## 📡 API 使用

### 创建 AI 助手

```typescript
// 使用 tRPC Client
const assistant = await client.aiAssistants.create.mutate({
  organizationId: 'org-uuid', // 可选
  name: 'DevOps 助手',
  type: 'devops-engineer',
  modelConfig: {
    provider: 'ollama',
    model: 'llama3.2:3b', // 或 'codellama:7b', 'qwen2.5:7b'
    temperature: 0.7,
  },
  systemPrompt: `你是一个专业的 DevOps 工程师。
你的职责是帮助用户：
1. 优化 CI/CD 流程
2. 解决部署问题
3. 提供最佳实践建议
4. 分析系统性能

请用简洁、专业的语言回答问题。`,
  isActive: true,
})
```

### 与 AI 对话

```typescript
// 普通对话
const response = await client.aiAssistants.chat.mutate({
  assistantId: assistant.id,
  message: '如何优化 Docker 镜像大小？',
  context: {
    currentSize: '1.2GB',
    baseImage: 'node:20',
  },
})

console.log(response.message)
```

### 检查 Ollama 状态

```typescript
const status = await client.aiAssistants.checkOllamaStatus.query()

console.log(status)
// {
//   available: true,
//   modelCount: 3,
//   models: ['llama3.2:3b', 'codellama:7b', 'qwen2.5:7b']
// }
```

### 列出可用模型

```typescript
const models = await client.aiAssistants.listOllamaModels.query()

models.forEach((model) => {
  console.log(`${model.name} - ${(model.size / 1024 / 1024 / 1024).toFixed(2)} GB`)
})
```

---

## 🎨 前端示例

### React 对话组件

```typescript
import { useState } from 'react'
import { trpc } from './trpc'

function AiChat({ assistantId }: { assistantId: string }) {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [loading, setLoading] = useState(false)

  const chatMutation = trpc.aiAssistants.chat.useMutation()

  const handleSend = async () => {
    if (!message.trim()) return

    // 添加用户消息
    const userMessage = { role: 'user', content: message }
    setMessages((prev) => [...prev, userMessage])
    setMessage('')
    setLoading(true)

    try {
      // 调用 AI
      const response = await chatMutation.mutateAsync({
        assistantId,
        message,
      })

      // 添加 AI 响应
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.message },
      ])
    } catch (error) {
      console.error('Chat error:', error)
      alert('对话失败：' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-container">
      {/* 消息列表 */}
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <strong>{msg.role === 'user' ? '你' : 'AI'}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
        {loading && <div className="loading">AI 正在思考...</div>}
      </div>

      {/* 输入框 */}
      <div className="input-area">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !message.trim()}>
          发送
        </button>
      </div>
    </div>
  )
}
```

### 检查 Ollama 状态

```typescript
function OllamaStatus() {
  const { data: status } = trpc.aiAssistants.checkOllamaStatus.useQuery()

  if (!status) return <div>检查中...</div>

  if (!status.available) {
    return (
      <div className="alert alert-error">
        ❌ Ollama 服务不可用
        <p>{status.error}</p>
        <a href="https://ollama.com/download" target="_blank">
          下载 Ollama
        </a>
      </div>
    )
  }

  return (
    <div className="alert alert-success">
      ✅ Ollama 服务正常
      <p>已安装 {status.modelCount} 个模型</p>
      <ul>
        {status.models.map((model) => (
          <li key={model}>{model}</li>
        ))}
      </ul>
    </div>
  )
}
```

---

## 🎯 推荐模型

### 1. llama3.2:3b (推荐新手)
- **大小**: 2GB
- **速度**: 非常快
- **用途**: 通用对话、代码解释
- **优点**: 资源占用少，响应快

```bash
ollama pull llama3.2:3b
```

### 2. codellama:7b (代码专用)
- **大小**: 3.8GB
- **速度**: 快
- **用途**: 代码审查、代码生成、Bug 修复
- **优点**: 专门针对代码优化

```bash
ollama pull codellama:7b
```

### 3. qwen2.5:7b (中文优化)
- **大小**: 4.7GB
- **速度**: 中等
- **用途**: 中文对话、中文代码注释
- **优点**: 中文理解能力强

```bash
ollama pull qwen2.5:7b
```

### 4. llama3.2:latest (最强大)
- **大小**: 26GB
- **速度**: 较慢
- **用途**: 复杂推理、深度分析
- **优点**: 能力最强

```bash
ollama pull llama3.2:latest
```

---

## 🎨 预设 AI 助手

### 1. 代码审查助手

```typescript
{
  name: '代码审查助手',
  type: 'code-reviewer',
  modelConfig: {
    provider: 'ollama',
    model: 'codellama:7b',
    temperature: 0.3, // 低温度，更精确
  },
  systemPrompt: `你是一个严格的代码审查专家。
审查代码时，请关注：
1. 代码质量和可读性
2. 潜在的 Bug 和安全问题
3. 性能优化建议
4. 最佳实践

请提供具体、可操作的建议。`
}
```

### 2. DevOps 工程师

```typescript
{
  name: 'DevOps 助手',
  type: 'devops-engineer',
  modelConfig: {
    provider: 'ollama',
    model: 'llama3.2:3b',
    temperature: 0.7,
  },
  systemPrompt: `你是一个经验丰富的 DevOps 工程师。
你擅长：
1. CI/CD 流程优化
2. Docker 和 Kubernetes
3. 监控和日志分析
4. 自动化部署

请提供实用的解决方案。`
}
```

### 3. 成本优化专家

```typescript
{
  name: '成本优化助手',
  type: 'cost-optimizer',
  modelConfig: {
    provider: 'ollama',
    model: 'llama3.2:3b',
    temperature: 0.5,
  },
  systemPrompt: `你是一个云成本优化专家。
你的任务是：
1. 分析资源使用情况
2. 识别浪费和优化机会
3. 提供具体的节省建议
4. 计算预期节省金额

请提供数据驱动的建议。`
}
```

---

## 🔧 Ollama 管理

### 查看已安装模型

```bash
ollama list
```

### 删除模型

```bash
ollama rm llama3.2:3b
```

### 更新模型

```bash
ollama pull llama3.2:3b
```

### 查看模型信息

```bash
ollama show llama3.2:3b
```

### 停止 Ollama 服务

```bash
# macOS
brew services stop ollama

# Linux
systemctl stop ollama
```

---

## 📊 性能对比

| 模型 | 大小 | 速度 | 质量 | 推荐用途 |
|------|------|------|------|---------|
| llama3.2:3b | 2GB | ⚡⚡⚡⚡⚡ | ⭐⭐⭐ | 快速对话 |
| codellama:7b | 3.8GB | ⚡⚡⚡⚡ | ⭐⭐⭐⭐ | 代码相关 |
| qwen2.5:7b | 4.7GB | ⚡⚡⚡ | ⭐⭐⭐⭐ | 中文对话 |
| llama3.2:latest | 26GB | ⚡⚡ | ⭐⭐⭐⭐⭐ | 复杂任务 |

---

## 🐛 故障排查

### Ollama 服务未运行

```bash
# 检查服务状态
curl http://localhost:11434/api/tags

# 如果失败，启动服务
ollama serve

# 或者重启
brew services restart ollama  # macOS
systemctl restart ollama      # Linux
```

### 模型未找到

```bash
# 列出已安装模型
ollama list

# 拉取缺失的模型
ollama pull llama3.2:3b
```

### 响应太慢

1. **使用更小的模型**: llama3.2:3b 而不是 llama3.2:latest
2. **降低温度**: temperature 设置为 0.3-0.5
3. **减少上下文**: 不要发送太长的消息

### 内存不足

```bash
# 查看模型大小
ollama list

# 删除不用的大模型
ollama rm llama3.2:latest

# 只保留小模型
ollama pull llama3.2:3b
```

---

## 💡 最佳实践

### 1. 选择合适的模型

- **快速原型**: llama3.2:3b
- **代码任务**: codellama:7b
- **中文场景**: qwen2.5:7b
- **复杂推理**: llama3.2:latest

### 2. 优化 System Prompt

```typescript
// ❌ 不好的 prompt
systemPrompt: '你是一个助手'

// ✅ 好的 prompt
systemPrompt: `你是一个专业的 DevOps 工程师。
你的职责是：
1. 分析 CI/CD 问题
2. 提供具体的解决方案
3. 解释技术概念

回答时请：
- 使用简洁的语言
- 提供代码示例
- 说明原因和影响`
```

### 3. 使用上下文

```typescript
// 提供相关上下文
await client.aiAssistants.chat.mutate({
  assistantId,
  message: '如何优化这个部署？',
  context: {
    currentStrategy: 'rolling',
    replicas: 3,
    updateTime: '5 minutes',
    errorRate: '2%',
  },
})
```

### 4. 温度设置

```typescript
// 代码生成 - 低温度（更精确）
temperature: 0.3

// 创意写作 - 高温度（更多样）
temperature: 0.9

// 通用对话 - 中等温度
temperature: 0.7
```

---

## 🎓 学习资源

- [Ollama 官网](https://ollama.com/)
- [Ollama 文档](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [模型库](https://ollama.com/library)
- [Llama 3.2 介绍](https://ollama.com/library/llama3.2)
- [CodeLlama 介绍](https://ollama.com/library/codellama)

---

## ✅ 测试清单

- [ ] Ollama 服务运行正常
- [ ] 至少安装一个模型
- [ ] 可以创建 AI 助手
- [ ] 可以进行对话
- [ ] 状态检查 API 工作
- [ ] 模型列表 API 工作
- [ ] 响应速度可接受
- [ ] 中文对话正常

---

## 🚀 下一步

1. **尝试不同模型** - 找到最适合你的
2. **优化 Prompt** - 提高回答质量
3. **添加对话历史** - 实现多轮对话
4. **集成到工作流** - 自动代码审查、部署建议

---

需要帮助？
```bash
# 查看 Ollama 日志
ollama logs

# 测试对话
ollama run llama3.2:3b
```
