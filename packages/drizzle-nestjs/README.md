# drizzle-nestjs

一个强大的 Drizzle ORM 与 NestJS 集成包，提供完整的数据库连接管理、事务支持、迁移工具和健康检查功能。

## 特性

- 🚀 **简单集成** - 与 NestJS 无缝集成
- 🔄 **多数据库支持** - 支持 PostgreSQL、MySQL 和 SQLite
- 🔗 **多连接管理** - 支持多个数据库连接
- 📦 **事务支持** - 声明式事务管理
- 🔧 **自动迁移** - 自动运行数据库迁移
- 💊 **健康检查** - 内置连接健康监控
- 📊 **统计信息** - 详细的连接和查询统计
- 🎯 **TypeScript** - 完整的 TypeScript 支持

## 安装

```bash
npm install drizzle-nestjs drizzle-orm
# 根据你的数据库选择对应的驱动
npm install postgres # PostgreSQL
npm install mysql2 # MySQL
npm install better-sqlite3 # SQLite
```

## 快速开始

### 1. 基本配置

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { DrizzleModule } from 'drizzle-nestjs'
import { DatabaseType } from 'drizzle-nestjs'

@Module({
  imports: [
    DrizzleModule.forRoot({
      connection: {
        type: DatabaseType.POSTGRES,
        connection: 'postgresql://user:password@localhost:5432/mydb',
        schema: {}, // 你的 Drizzle schema
      },
      logging: true,
      autoMigrate: true,
      migrationsFolder: './migrations',
    }),
  ],
})
export class AppModule {}
```

### 2. 使用数据库连接

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common'
import { InjectDrizzle } from 'drizzle-nestjs'
import type { DrizzleDatabase } from 'drizzle-nestjs'

@Injectable()
export class UserService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDatabase
  ) {}

  async findAll() {
    return this.db.select().from(users)
  }

  async create(userData: CreateUserDto) {
    return this.db.insert(users).values(userData).returning()
  }
}
```

### 3. 事务支持

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common'
import { Transaction, InjectDrizzle } from 'drizzle-nestjs'
import type { DrizzleDatabase } from 'drizzle-nestjs'

@Injectable()
export class UserService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDatabase
  ) {}

  @Transaction()
  async createUserWithProfile(userData: CreateUserDto, profileData: CreateProfileDto) {
    const [user] = await this.db.insert(users).values(userData).returning()
    const [profile] = await this.db.insert(profiles).values({
      ...profileData,
      userId: user.id,
    }).returning()
    
    return { user, profile }
  }

  @Transaction({ 
    isolationLevel: TransactionIsolationLevel.SERIALIZABLE,
    timeout: 5000 
  })
  async complexOperation() {
    // 自定义事务配置
  }
}
```

## 高级用法

### 异步配置

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { DrizzleModule } from 'drizzle-nestjs'

@Module({
  imports: [
    ConfigModule.forRoot(),
    DrizzleModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          type: configService.get('DB_TYPE'),
          connection: configService.get('DATABASE_URL'),
          schema: {}, // 你的 schema
        },
        logging: configService.get('NODE_ENV') === 'development',
        autoMigrate: true,
        migrationsFolder: './migrations',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### 多连接配置

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { DrizzleModule } from 'drizzle-nestjs'

@Module({
  imports: [
    DrizzleModule.forMultipleConnections({
      defaultConnection: 'primary',
      connections: [
        {
          name: 'primary',
          connection: {
            type: DatabaseType.POSTGRES,
            connection: 'postgresql://localhost:5432/primary',
            schema: primarySchema,
          },
        },
        {
          name: 'analytics',
          connection: {
            type: DatabaseType.POSTGRES,
            connection: 'postgresql://localhost:5432/analytics',
            schema: analyticsSchema,
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

```typescript
// service.ts
@Injectable()
export class DataService {
  constructor(
    @InjectDrizzle('primary') private readonly primaryDb: DrizzleDatabase,
    @InjectDrizzle('analytics') private readonly analyticsDb: DrizzleDatabase
  ) {}
}
```

### 自定义事务配置

```typescript
@Injectable()
export class OrderService {
  @Transaction({
    isolationLevel: TransactionIsolationLevel.READ_COMMITTED,
    timeout: 10000,
    readOnly: false,
    label: 'create-order',
  })
  async createOrder(orderData: CreateOrderDto) {
    // 事务逻辑
  }

  @ReadOnlyTransaction()
  async getOrderStats() {
    // 只读事务
  }

  @NewTransaction()
  async independentOperation() {
    // 总是创建新事务
  }
}
```

### 手动事务管理

```typescript
@Injectable()
export class PaymentService {
  constructor(
    @InjectDrizzleService() private readonly drizzleService: DrizzleService
  ) {}

  async processPayment(paymentData: PaymentDto) {
    const transaction = await this.drizzleService.beginTransaction({
      isolationLevel: TransactionIsolationLevel.SERIALIZABLE,
      timeout: 30000,
    })

    try {
      // 执行支付逻辑
      await transaction.tx.insert(payments).values(paymentData)
      
      // 更新账户余额
      await transaction.tx.update(accounts)
        .set({ balance: sql`balance - ${paymentData.amount}` })
        .where(eq(accounts.id, paymentData.accountId))

      await this.drizzleService.commitTransaction(transaction.id)
    } catch (error) {
      await this.drizzleService.rollbackTransaction(transaction.id)
      throw error
    }
  }
}
```

### 迁移管理

```typescript
@Injectable()
export class MigrationService {
  constructor(
    @InjectDrizzleService() private readonly drizzleService: DrizzleService
  ) {}

  async runMigrations() {
    const result = await this.drizzleService.migrate()
    console.log(`Executed ${result.migrationsExecuted} migrations`)
  }

  async checkMigrationStatus() {
    const status = await this.drizzleService.getMigrationStatus()
    console.log(`Pending: ${status.pendingMigrations.length}`)
    console.log(`Applied: ${status.appliedMigrations.length}`)
  }
}
```

### 健康检查

```typescript
@Injectable()
export class HealthService {
  constructor(
    @InjectDrizzleService() private readonly drizzleService: DrizzleService
  ) {}

  async checkDatabaseHealth() {
    const results = await this.drizzleService.healthCheck()
    return results.map(result => ({
      name: result.name,
      healthy: result.healthy,
      responseTime: result.responseTime,
    }))
  }

  async getStats() {
    return this.drizzleService.getStats()
  }
}
```

## API 参考

### 模块配置

#### `DrizzleModuleOptions`

```typescript
interface DrizzleModuleOptions {
  name?: string // 连接名称
  connection: DatabaseConnectionConfig // 数据库连接配置
  logging?: boolean | Logger // 日志配置
  development?: boolean // 开发模式
  autoMigrate?: boolean // 自动迁移
  migrationsFolder?: string // 迁移文件夹
  defaultIsolationLevel?: TransactionIsolationLevel // 默认事务隔离级别
  retry?: RetryConfig // 重试配置
  healthCheck?: HealthCheckConfig // 健康检查配置
}
```

#### `DatabaseConnectionConfig`

```typescript
interface DatabaseConnectionConfig {
  type: DatabaseType // 数据库类型
  connection: string | Record<string, any> // 连接配置
  schema?: Record<string, any> // Drizzle schema
  pool?: PoolConfig // 连接池配置
  ssl?: boolean | Record<string, any> // SSL 配置
}
```

### 装饰器

- `@InjectDrizzle(connectionName?)` - 注入数据库连接
- `@InjectDrizzleService()` - 注入 Drizzle 服务
- `@Transaction(config?)` - 事务装饰器
- `@ReadOnlyTransaction(config?)` - 只读事务装饰器
- `@NewTransaction(config?)` - 新事务装饰器
- `@InjectTransaction(connectionName?)` - 注入事务上下文

### 服务方法

#### `DrizzleService`

- `createConnection(name, options)` - 创建连接
- `getConnection(name?)` - 获取连接
- `beginTransaction(config?, connectionName?)` - 开始事务
- `commitTransaction(transactionId)` - 提交事务
- `rollbackTransaction(transactionId)` - 回滚事务
- `migrate(connectionName?, migrationsFolder?)` - 运行迁移
- `getMigrationStatus(connectionName?, migrationsFolder?)` - 获取迁移状态
- `healthCheck(connectionName?)` - 健康检查
- `getStats()` - 获取统计信息

## 许可证

MIT