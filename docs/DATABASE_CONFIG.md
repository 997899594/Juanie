# 数据库配置说明

## 🎯 自动构建连接字符串

从现在开始,你**不需要**手动配置 `DATABASE_URL`!

系统会自动从以下变量构建数据库连接字符串:

```bash
POSTGRES_USER=findbiao
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=localhost        # 可选,默认 localhost
POSTGRES_PORT=5432             # 可选,默认 5432
POSTGRES_DB=juanie_ai_devops
```

自动构建的连接字符串:
```
postgresql://findbiao:your_password@localhost:5432/juanie_ai_devops
```

## ✅ 优点

1. **避免重复** - 不需要在多处维护相同的配置
2. **减少错误** - 不会出现配置不一致的问题
3. **更简洁** - 配置文件更清晰易读

## 🔧 配置方式

### 方式 1: 自动构建 (推荐)

只需配置 `POSTGRES_*` 变量:

```bash
# .env
POSTGRES_USER=findbiao
POSTGRES_PASSWORD=biao1996.
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=juanie_ai_devops
```

系统会自动构建连接字符串并在启动时显示:
```
📦 使用自动构建的数据库连接: postgresql://findbiao:***@localhost:5432/juanie_ai_devops
```

### 方式 2: 手动指定 (可选)

如果需要特殊的连接字符串(如使用 SSL、连接池等),可以手动设置 `DATABASE_URL`:

```bash
# .env
POSTGRES_USER=findbiao
POSTGRES_PASSWORD=biao1996.
POSTGRES_DB=juanie_ai_devops

# 自定义连接字符串
DATABASE_URL=postgresql://findbiao:biao1996.@db.example.com:5432/juanie_ai_devops?sslmode=require
```

**优先级**: `DATABASE_URL` > 自动构建

## 📋 完整示例

### 开发环境

```bash
# .env
POSTGRES_USER=dev_user
POSTGRES_PASSWORD=dev_pass
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=juanie_dev
```

### 生产环境

```bash
# .env.prod
POSTGRES_USER=prod_user
POSTGRES_PASSWORD=strong_prod_password
POSTGRES_HOST=prod-db.example.com
POSTGRES_PORT=5432
POSTGRES_DB=juanie_prod

# 或使用自定义连接字符串
DATABASE_URL=postgresql://prod_user:strong_prod_password@prod-db.example.com:5432/juanie_prod?sslmode=require&pool_max=20
```

## 🔍 验证配置

运行配置检查脚本:

```bash
bun run check:env
```

输出示例:
```
✅ POSTGRES_USER
✅ POSTGRES_PASSWORD
✅ POSTGRES_DB
✅ 将自动从 POSTGRES_* 变量构建数据库连接
```

## 🐛 故障排查

### 问题: 数据库连接失败

**检查步骤**:

1. 验证配置变量:
```bash
bun run check:env
```

2. 检查 Docker 容器状态:
```bash
docker-compose ps postgres
```

3. 测试数据库连接:
```bash
docker-compose exec postgres pg_isready -U $POSTGRES_USER
```

4. 查看应用日志:
```bash
bun dev
# 查找 "📦 使用自动构建的数据库连接" 日志
```

### 问题: 配置不一致警告

如果同时设置了 `DATABASE_URL` 和 `POSTGRES_*`,检查脚本会警告:

```
⚠️  DATABASE_URL 与 POSTGRES_* 变量可能不一致
   建议删除 DATABASE_URL,让系统自动构建
```

**解决方案**: 删除 `DATABASE_URL`,使用自动构建。

## 📚 相关文档

- [配置管理指南](./CONFIGURATION.md)
- [快速启动指南](../QUICK_START.md)
- [故障排查](./TROUBLESHOOTING.md)
