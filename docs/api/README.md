# API Reference

API 文档将从代码注释自动生成。

## 使用 TypeDoc

```bash
# 生成 API 文档
bun run docs:api

# 查看文档
open docs/api/index.html
```

## API 端点

所有 API 通过 tRPC 提供，类型安全且自动生成客户端。

查看 `apps/api-gateway/src/routers/` 了解可用的 API 路由。

## 在线文档

开发模式下访问：http://localhost:3000/api/trpc-panel
