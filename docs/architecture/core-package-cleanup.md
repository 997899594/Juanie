# Core Package 架构清理

> 时间: 2024-12-24  
> 问题: date 重复创建连接

## 🎯 重构目标

1. **分离职责** - Database 和 Redi

3. **统一接口*

## 构

```
packages/core/src/
├── database/
│   ├── client.ts           # cre唯一的连接创建函数
│   ├── database.module.ts  # Neslient
│   └── index.ts
│
├── redis/
│   ├── client.ts           # createRedisClient()数
│   ├── redis.module.ts     # NestJS Mlient
│   └── index.ts
│
导出
```

## ✅ 改进点

###

**之前**:
```typescript
// client.ts - 创建
const client = p. })
return drizzle(client, { schema })

// database.module.ts - 创建方式 2（重复代码）
const client = postgres(connectionSt. })
return drizzle(client, { schema, logger: ... })
```

**现在**:
```typescript
// 一的创建函数
) {
  const client = 
er })
}

// database.module.ts - 复用创建函数

  conneg,
  loggeomLogger,
})
```

### 2. 分离 Redis

**之
script
// data一起
@Mo({
  providers: [
    { provide: DATABASE, useFactory: ... },
    { provide: REDIS, useFactory: ... },  // ❌ 职责不清
  ]
})


**现**:
```typescript
// database.module.ts - 只管 Database
@Module({
  providers: [{ provide: DATABASE, us
  exports: [DATABASE],
})

// redis.module.ts

  providers: [{ .. }],

})
```

### 3. 统一配置接口

```typescript
// database/client.ts
export interface DatabaseConfig {
  connectionString: string
  m
mber
  connecter
  prepare?: boole
  logger?: boole }
}

// redis/client.ts
export interface RedisConfig {
  url: string
  lazyoolean
n
  onConnect?: 
  onError?: (errvoid
}
```

## 📝 使用方式

### NeS 应用

```typescript
odule.ts
import { DatabaseModule } from '@juanie/core/database'
s'

@Module({
  imports: [
    DatabaseModule,  // 提供 DATABASE token

  ],
})
export class AppModule {}

// my.service.ts
imp
e/core'


export class MyService {
ctor(
    @Injeient,
    @Inent,
  ) {}
}
```

### 脚本/W

```typescript

import { createDatabaseCliore'
abase'

nt({
  connectURL!,
})

cont({

})

// 使用
)
await redis.set('key', 'vale')


## 🎯 设计原则

1. **单一职责** - Database 和 Redis 各自独立
2. 
置接口清晰明确
4. **易于测试** - client.ts 可以独立测试
5. **易于扩展** -循相同模式

## 📊 对比


|------|------|----|
| 连接创建 | 重复代码|
| 职责分离 | 模块 |
| 配置接口 | 隐式参数 | 显式 Config  |
| 可测试性 | 难以测试 | 易于测试 |
| 可扩展性 | 难以扩展 | 遵循统一模式 |

## 🔄 迁移指南



```typescript
// 之前
import { Dat

@Mo({
IS
})

// 现在
abase'
import { 

@Module({
  i
DATABASE
    RediDIS
  ],
})
``



pt
// 之前
imp
const db = createDatabas!)

// 现在（保持兼容）
import { createDatabaseClient } from 

  connecti_URL!,
})
```

##  验证清单

- [x] Dataase 连接

- [x] createDatabaseCli辑
- [x] createRedisClient 和 redis.m
- [x] 配置接口清晰明确
- [x] 类型定义完整
- [x] 向后兼容（通过配置接口）

## 🚀 下一步

1. 更新所有使用 DatabaseModule 的地方，添加 sModule
2. 更新脚本使用新的配置接口
逻辑
4. 考虑添加连接池监控
