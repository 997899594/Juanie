# Core Package 结构分析

**Date**: 2024-12-24  
**问题**: Core 里有的是类，有的是 modules，有的是方法，这样没问题吗？

---

## 🎯 问题分析

### 当前 Core 包结构

```
packages/core/src/
├── database/           Module + Client Function
├── redis/              Module + Client Function
├── queue/              Module + Service
├── encryption/         Module + Service
├── storage/            Module + Service
├── events/             Module + Constants
├── errors/             Classes
├── tokens/             Constants (Symbols)
├── observability/      Decorator Function
└── utils/              Pure Functions
```

### 三种不同的模式

**模式 1: Module + Client Function** (Database, Redis)
```typescript
// 导出 NestJS Module
export class DatabaseModule {}

// 导出工厂函数
export function createDatabaseClient() {}
```

**模式 2: Module + Service** (Queue, Encryption, Storage)
```typescript
// 导出 NestJS Module
export class QueueModule {}

// 导出 Injectable Service
@Injectable()
export class EncryptionService {}
```

**模式 3: Pure Functions/Classes** (Utils, Observability, Errors, Tokens)
```typescript
// 纯函数
export function generateId() {}

// 装饰器
export function Trace() {}

// 错误类
export class BaseError {}

// 常量
export const DATABASE = Symbol('DATABASE')
```

---

## ✅ 这样设计是否合理？

### 答案：**合理，但可以更一致**

### 为什么合理？

1. **Database/Redis** - Module + Client Function
   - ✅ Module 用于 NestJS 依赖注入
   - ✅ Client Function 用于非 NestJS 环境（如测试、脚本）
   - ✅ 这是**灵活性设计**，支持多种使用场景

2. **Queue/Encryption/Storage** - Module + Service
   - ✅ 标准的 NestJS 服务模式
   - ✅ Service 包含业务逻辑（配置、错误处理）
   - ✅ 通过 DI 注入使用

3. **Utils/Observability/Errors/Tokens** - Pure Functions/Classes
   - ✅ 无状态工具，不需要 DI
   - ✅ 可以直接导入使用
   - ✅ 简单直接

### 为什么可以更一致？

**问题**: Encryption 和 Storage 的定位不清晰

---

## 🔍 深入分析：Encryption 和 Storage 应该在哪一层？

### Encryption Service 分析

**当前实现**:
```typescript
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm'
  
  constructor(private readonly logger: PinoLogger) {}
  
  private getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY
    if (!key) throw new EncryptionKeyMissingError()
    return Buffer.from(key.padEnd(32, '0').slice(0, 32))
  }
  
  encrypt(plaintext: string): string { /* ... */ }
  decrypt(ciphertext: string): string { /* ... */ }
  test(): Promise<boolean> { /* ... */ }
}
```

**特征**:
- ✅ 使用 Node.js 内置 crypto（纯基础设施）
- ✅ 无业务逻辑
- ✅ 可重用的加密工具
- ❌ 但有配置管理（getKey）
- ❌ 但有错误处理逻辑

**判断**: **应该在 Core 层**
- 理由：加密是纯技术能力，不涉及业务概念
- 但需要简化：移除业务逻辑，只保留纯加密功能

---

### Storage Service 分析

**当前实现**:
```typescript
@Injectable()
export class StorageService {
  private minioClient: Client
  private bucketName = 'juanie'
  
  constructor(
    private config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.minioClient = new Client({ /* ... */ })
    this.ensureBucketExists()
  }
  
  private async ensureBucketExists() { /* 业务逻辑 */ }
  
  async uploadFile(...) { /* ... */ }
  async deleteFile(...) { /* ... */ }
  async getPresignedUrl(...) { /* ... */ }
  async fileExists(...) { /* ... */ }
}
```

**特征**:
- ✅ 使用 MinIO 客户端（基础设施）
- ❌ 有业务逻辑（ensureBucketExists）
- ❌ 有配置管理（bucket 名称、策略）
- ❌ 有初始化逻辑（构造函数中）

**判断**: **应该在 Foundation 层**
- 理由：包含业务逻辑（bucket 管理、策略设置）
- 理由：不是纯技术能力，而是"存储服务"

---

## 🎯 正确的分层原则

### Core 层应该包含什么？

**✅ 应该包含**:
1. **纯技术基础设施** - Database, Redis, Queue
2. **无状态工具** - ID 生成、加密算法
3. **共享常量** - DI Tokens, Event Types
4. **基础类型** - Base Errors
5. **技术装饰器** - @Trace

**❌ 不应该包含**:
1. **有业务逻辑的服务** - Storage (bucket 管理)
2. **有初始化逻辑的服务** - Storage (ensureBucketExists)
3. **有配置管理的服务** - Storage (bucket 策略)

### 判断标准

**问题**: 如何判断一个 Service 应该在 Core 还是 Foundation？

**标准**:
```
如果回答"是"，放 Core；如果回答"否"，放 Foundation

1. 是否是纯技术能力？（不涉及业务概念）
2. 是否无状态？（或状态只是技术配置）
3. 是否可以在任何项目中复用？（不依赖业务上下文）
4. 是否只是对第三方库的薄包装？（无额外逻辑）
```

**应用到 Encryption 和 Storage**:

| 问题 | Encryption | Storage |
|------|-----------|---------|
| 纯技术能力？ | ✅ 是（加密） | ❌ 否（存储服务） |
| 无状态？ | ✅ 是 | ❌ 否（bucket 状态） |
| 任何项目复用？ | ✅ 是 | ⚠️ 部分（需要配置） |
| 薄包装？ | ✅ 是 | ❌ 否（有业务逻辑） |

**结论**:
- **Encryption**: 应该在 Core（但需要简化）
- **Storage**: 应该在 Foundation

---

## 📋 推荐的 Core 包结构

### 理想结构

```
packages/core/src/
├── database/           ✅ Module + Client Function
│   ├── database.module.ts
│   ├── client.ts
│   └── index.ts
│
├── redis/              ✅ Module + Client Function
│   ├── redis.module.ts
│   ├── client.ts
│   └── index.ts
│
├── queue/              ✅ Module + Tokens
│   ├── queue.module.ts
│   ├── tokens.ts
│   └── index.ts
│
├── events/             ✅ Module + Constants
│   ├── events.module.ts
│   ├── event-types.ts
│   └── index.ts
│
├── encryption/         ✅ Pure Functions (简化)
│   ├── encrypt.ts
│   ├── decrypt.ts
│   └── index.ts
│
├── errors/             ✅ Classes
│   ├── base-errors.ts
│   └── index.ts
│
├── tokens/             ✅ Constants
│   └── index.ts
│
├── observability/      ✅ Decorator
│   ├── trace.decorator.ts
│   └── index.ts
│
└── utils/              ✅ Pure Functions
    ├── id.ts
    └── index.ts
```

### 移除的模块

```
❌ storage/  → 移到 @juanie/service-foundation
```

---

## 🔧 具体改进建议

### 1. 简化 Encryption（保留在 Core）

**当前**:
```typescript
@Injectable()
export class EncryptionService {
  constructor(private readonly logger: PinoLogger) {}
  private getKey(): Buffer { /* 配置逻辑 */ }
  encrypt(plaintext: string): string { /* ... */ }
  decrypt(ciphertext: string): string { /* ... */ }
}
```

**改进为**:
```typescript
// packages/core/src/encryption/index.ts
export function encrypt(plaintext: string, key: string): string {
  // 纯加密逻辑，无配置、无日志
}

export function decrypt(ciphertext: string, key: string): string {
  // 纯解密逻辑
}
```

**使用**:
```typescript
// Foundation 层创建 EncryptionService
@Injectable()
export class EncryptionService {
  constructor(private config: ConfigService) {}
  
  encrypt(plaintext: string): string {
    const key = this.config.get('ENCRYPTION_KEY')
    return encrypt(plaintext, key)  // 使用 Core 的纯函数
  }
}
```

### 2. 移动 Storage 到 Foundation

**原因**:
- Storage 有业务逻辑（bucket 管理）
- Storage 有初始化逻辑
- Storage 不是纯技术能力

**移动**:
```bash
mv packages/core/src/storage packages/services/foundation/src/storage
```

---

## 📊 最终评分

### 当前结构评分

| 方面 | 评分 | 说明 |
|------|------|------|
| 一致性 | ⭐⭐⭐ | 有三种不同模式，但都有合理理由 |
| 清晰度 | ⭐⭐⭐⭐ | 大部分模块职责清晰 |
| 分层纯度 | ⭐⭐⭐ | Encryption 和 Storage 定位不清 |
| 可维护性 | ⭐⭐⭐⭐ | 结构清晰，易于理解 |

**总分**: ⭐⭐⭐ (3.5/5)

### 改进后评分

| 方面 | 评分 | 说明 |
|------|------|------|
| 一致性 | ⭐⭐⭐⭐ | 模式更统一 |
| 清晰度 | ⭐⭐⭐⭐⭐ | 每个模块职责明确 |
| 分层纯度 | ⭐⭐⭐⭐⭐ | Core 只包含纯基础设施 |
| 可维护性 | ⭐⭐⭐⭐⭐ | 结构清晰，易于扩展 |

**总分**: ⭐⭐⭐⭐⭐ (4.75/5)

---

## 🎯 结论

### 回答你的问题

**Q1: Core 里有的是类，有的是 modules，有的是方法，没问题吗？**

**A**: **有一点问题，但不严重**
- ✅ 不同模式有合理理由（灵活性、简单性）
- ❌ Encryption 和 Storage 定位不清晰
- ✅ 大部分模块设计合理

**Q2: Encryption 和 Storage 到底应该在哪个层？**

**A**: 
- **Encryption**: **应该在 Core**（但需要简化为纯函数）
- **Storage**: **应该在 Foundation**（包含业务逻辑）

### 推荐行动

**立即行动**:
1. ✅ 保持当前结构（已经很好了）
2. 📝 记录设计决策（为什么有不同模式）

**未来优化**:
1. 简化 Encryption 为纯函数
2. 移动 Storage 到 Foundation 层
3. 统一文档说明各模块的设计模式

**优先级**: 低（当前结构可以工作，不影响开发）
