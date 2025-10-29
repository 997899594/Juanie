# 故障排查指南

常见问题和解决方案。

## 数据库问题

### 连接失败

**症状**: `ECONNREFUSED` 或 `Connection refused`

**解决方案**:
```bash
# 1. 检查 PostgreSQL 是否运行
docker ps | grep postgres

# 2. 检查端口是否正确
docker port devops-postgres

# 3. 重启 PostgreSQL
docker-compose restart postgres

# 4. 检查日志
docker logs devops-postgres
```

### 迁移失败

**症状**: `Migration failed` 或表已存在

**解决方案**:
```bash
# 1. 检查当前数据库状态
docker exec devops-postgres psql -U devops_user -d devops -c "\dt"

# 2. 重新生成迁移
bun run db:generate

# 3. 强制推送（谨慎使用）
bun run db:push

# 4. 如果需要重置数据库
docker-compose down -v
docker-compose up -d postgres
bun run db:push
```

## 缓存问题

### Dragonfly 连接失败

**症状**: `Redis connection error`

**解决方案**:
```bash
# 1. 检查 Dragonfly 状态
docker ps | grep dragonfly

# 2. 测试连接
docker exec devops-dragonfly redis-cli -a dragonfly_password ping

# 3. 重启 Dragonfly
docker-compose restart dragonfly
```

## 对象存储问题

### MinIO 上传失败

**症状**: `Access Denied` 或 `Bucket not found`

**解决方案**:
```bash
# 1. 访问 MinIO Console
open http://localhost:9001

# 2. 检查 bucket 是否存在
# 登录后查看 Buckets 列表

# 3. 检查访问密钥
# 确保 .env 中的 MINIO_ACCESS_KEY 和 MINIO_SECRET_KEY 正确
```

## 容器问题

### 端口被占用

**症状**: `Port already in use`

**解决方案**:
```bash
# 1. 查找占用端口的进程
lsof -i :3001  # 或其他端口

# 2. 停止进程
kill -9 <PID>

# 3. 或修改 docker-compose.yml 中的端口映射
```

### 容器无法启动

**症状**: 容器状态为 `Exited` 或 `Restarting`

**解决方案**:
```bash
# 1. 查看容器日志
docker logs <container-name>

# 2. 检查资源使用
docker stats

# 3. 清理并重启
docker-compose down
docker system prune -f
docker-compose up -d
```

## 性能问题

### API 响应慢

**检查清单**:
1. 数据库查询是否优化
2. 是否启用了缓存
3. 是否有慢查询日志
4. 连接池配置是否合理

**解决方案**:
```bash
# 1. 查看 Prometheus 指标
open http://localhost:9090

# 2. 查看 Grafana 仪表板
open http://localhost:3300

# 3. 检查数据库慢查询
docker exec devops-postgres psql -U devops_user -d devops -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"
```

### 内存占用高

**解决方案**:
```bash
# 1. 检查内存使用
docker stats

# 2. 调整 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=2048" bun run dev

# 3. 优化数据库连接池
# 编辑 docker-compose.yml 中的 PgBouncer 配置
```

## 监控问题

### Grafana 无法访问

**解决方案**:
```bash
# 1. 检查 Grafana 状态
docker ps | grep grafana

# 2. 检查日志
docker logs devops-grafana

# 3. 重启 Grafana
docker-compose restart grafana

# 4. 访问
open http://localhost:3300
# 默认账号: admin/admin
```

### Prometheus 无数据

**解决方案**:
```bash
# 1. 检查 Prometheus 配置
cat config/prometheus.yml

# 2. 检查 targets 状态
open http://localhost:9090/targets

# 3. 确保应用暴露了 metrics 端点
curl http://localhost:3001/metrics
```

## 开发问题

### 热重载不工作

**解决方案**:
```bash
# 1. 确保使用 --hot 标志
bun --hot src/main.ts

# 2. 检查文件监听限制（Linux）
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 3. 重启开发服务器
```

### TypeScript 类型错误

**解决方案**:
```bash
# 1. 清理并重新安装
rm -rf node_modules bun.lockb
bun install

# 2. 重新生成类型
bun run type-check

# 3. 重启 IDE
```

## 测试问题

### 测试失败

**解决方案**:
```bash
# 1. 确保测试数据库运行
docker ps | grep postgres

# 2. 重置测试数据库
DATABASE_URL=$DATABASE_URL_TEST bun run db:push

# 3. 运行单个测试
bun test src/modules/auth/auth.service.spec.ts

# 4. 查看详细输出
bun test --reporter=verbose
```

## 部署问题

### Docker 构建失败

**解决方案**:
```bash
# 1. 清理 Docker 缓存
docker builder prune -f

# 2. 重新构建
docker build --no-cache -t ai-devops-platform .

# 3. 检查 Dockerfile 语法
docker build --check .
```

### 生产环境错误

**检查清单**:
1. 环境变量是否正确配置
2. 数据库迁移是否已执行
3. 依赖服务是否可访问
4. 日志中是否有错误信息

**解决方案**:
```bash
# 1. 检查环境变量
env | grep DATABASE_URL

# 2. 检查服务健康状态
curl http://localhost:3001/health

# 3. 查看应用日志
docker logs <container-name> --tail 100 -f
```

## 获取更多帮助

如果以上方案都无法解决问题：

1. 查看 [GitHub Issues](https://github.com/your-repo/issues)
2. 搜索相关错误信息
3. 提交新的 Issue，包含：
   - 错误信息
   - 复现步骤
   - 环境信息
   - 相关日志

## 常用命令速查

```bash
# 查看所有容器状态
docker-compose ps

# 查看所有日志
docker-compose logs -f

# 重启所有服务
docker-compose restart

# 完全重置
docker-compose down -v
docker-compose up -d

# 进入容器
docker exec -it devops-postgres bash

# 查看数据库
docker exec devops-postgres psql -U devops_user -d devops

# 清理 Docker
docker system prune -af --volumes
```
