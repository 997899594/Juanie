# Business Services

业务层服务 - 提供核心的项目管理、部署和 GitOps 功能。

## 包含的服务

- **ProjectsService** - 项目、环境、模板管理
- **DeploymentsService** - 部署、仓库、管道管理
- **GitOpsService** - Flux、K3s、Git 操作

## 使用

```typescript
import { 
  ProjectsService, 
  DeploymentsService, 
  GitOpsService 
} from '@juanie/service-business'
```
