# 项目创建流程检查清单

## 当前状态

✅ **已完成的部分**:
1. ✅ Flux CD 已安装在 K3s 集群
2. ✅ 仓库可以正常创建
3. ✅ 前后端字段对齐修复
4. ✅ SSE 实时进度连接修复
5. ✅ 状态机架构完整实现

## 完整的项目创建流程

### 1. 前端触发 (✅ 已实现)
- 用户在 Web 界面填写项目信息
- 选择模板（如 nextjs-15-app）
- 配置 Git 仓库（GitHub/GitLab）
- 提交创建请求

### 2. 后端处理 (✅ 已实现)
**API 路由**: `apps/api-gateway/src/routers/projects.router.ts`
- 接收 tRPC 请求
- 调用 `ProjectsService.create()`

### 3. 项目编排器 (✅ 已实现)
**服务**: `packages/services/business/src/projects/project-orchestrator.service.ts`
- 调用 `createAndInitialize()`
- 启动状态机

### 4. 状态机执行 (✅ 已实现)
**状态机**: `packages/services/business/src/projects/initialization/state-machine.ts`

#### 状态 1: CREATING_PROJECT (✅)
- **Handler**: `create-project.handler.ts`
- **操作**: 在数据库创建项目记录
- **进度**: 10%

#### 状态 2: LOADING_TEMPLATE (✅)
- **Handler**: `load-template.handler.ts`
- **操作**: 从 `templates/` 目录加载模板配置
- **进度**: 30%

#### 状态 3: RENDERING_TEMPLATE (✅)
- **Handler**: `render-template.handler.ts`
- **操作**: 渲染模板变量（项目名、环境等）
- **进度**: 50%

#### 状态 4: CREATING_ENVIRONMENTS (✅)
- **Handler**: `create-environments.handler.ts`
- **操作**: 创建 dev/staging/prod 环境记录
- **进度**: 60%

#### 状态 5: SETTING_UP_REPOSITORY (⚠️ 需要验证)
- **Handler**: `setup-repository.handler.ts`
- **操作**: 
  - 解析 OAuth token
  - 创建 Git 仓库（GitHub/GitLab）
  - 推送模板代码
- **进度**: 70%
- **状态**: 仓库创建已成功，需要验证代码推送

#### 状态 6: CREATING_GITOPS (⚠️ 需要验证)
- **Handler**: `create-gitops.handler.ts`
- **操作**:
  - 为每个环境创建 Kustomization 资源
  - 应用到 K3s 集群
  - 等待 Flux 同步
- **进度**: 85%
- **依赖**: 
  - ✅ Flux CD 已安装
  - ⚠️ 需要验证 GitRepository 和 Kustomization 创建

#### 状态 7: FINALIZING (✅)
- **Handler**: `finalize.handler.ts`
- **操作**: 
  - 更新项目状态为 'active'
  - 发送通知
  - 记录审计日志
- **进度**: 95%

#### 状态 8: COMPLETED (✅)
- **进度**: 100%
- **SSE 事件**: `initialization.completed`

## 需要验证的关键点

### 1. GitOps 资源创建 (⚠️ 待验证)

**检查点**:
```bash
# 1. 检查 GitRepository 是否创建
kubectl get gitrepositories -n default

# 2. 检查 Kustomization 是否创建
kubectl get kustomizations -n default

# 3. 查看 Flux 日志
kubectl logs -n flux-system -l app=kustomize-controller

# 4. 检查资源状态
kubectl describe kustomization <project-name>-dev -n default
```

**预期结果**:
- GitRepository 状态为 `Ready`
- Kustomization 状态为 `Ready`
- 应用资源已部署到集群

### 2. 模板代码推送 (⚠️ 待验证)

**检查点**:
- 访问创建的 GitHub/GitLab 仓库
- 验证模板文件是否已推送
- 检查 k8s 目录结构是否正确

**预期文件结构**:
```
<repo>/
├── app/                    # 应用代码
├── k8s/
│   ├── base/              # 基础配置
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   └── overlays/          # 环境覆盖
│       ├── dev/
│       ├── staging/
│       └── prod/
└── ci/                    # CI/CD 配置
```

### 3. 环境配置 (⚠️ 待验证)

**检查点**:
```sql
-- 查看环境记录
SELECT * FROM environments WHERE project_id = '<project-id>';

-- 查看 GitOps 资源
SELECT * FROM gitops_resources WHERE project_id = '<project-id>';
```

**预期结果**:
- 3 个环境记录（dev, staging, prod）
- 每个环境对应一个 GitOps 资源

## 下一步行动

### 立即执行:

1. **测试完整流程**
   ```bash
   # 1. 确保服务运行
   bun run dev
   
   # 2. 在 Web 界面创建项目
   # 3. 观察 SSE 进度
   # 4. 检查后端日志
   ```

2. **验证 GitOps 资源**
   ```bash
   # 连接到 K3s 集群
   export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
   
   # 检查 Flux 状态
   flux check
   
   # 查看所有 GitOps 资源
   kubectl get gitrepositories,kustomizations -A
   ```

3. **检查数据库状态**
   ```bash
   # 连接到数据库
   bun run db:studio
   
   # 或使用 psql
   psql $DATABASE_URL
   ```

### 可能需要修复的问题:

1. **K3s 连接配置**
   - 确保 API Gateway 可以访问 K3s API
   - 检查 kubeconfig 配置

2. **Git 凭证**
   - 验证 OAuth token 是否有效
   - 检查仓库权限

3. **Flux 同步**
   - 确保 Flux 可以访问 Git 仓库
   - 检查 SSH key 或 token 配置

## 成功标准

项目创建成功的标志:
- ✅ 项目记录在数据库中
- ✅ Git 仓库已创建并包含模板代码
- ✅ 环境记录已创建
- ✅ GitOps 资源已创建并处于 Ready 状态
- ✅ 应用已部署到 K3s 集群
- ✅ 前端显示 "初始化完成"

## 调试技巧

### 查看后端日志
```bash
# API Gateway 日志
docker logs juanie-api-gateway -f

# 或直接运行时的控制台输出
```

### 查看 Flux 日志
```bash
# Source Controller (处理 Git 仓库)
kubectl logs -n flux-system -l app=source-controller -f

# Kustomize Controller (处理 Kustomization)
kubectl logs -n flux-system -l app=kustomize-controller -f
```

### 查看 SSE 事件
```bash
# 在浏览器控制台
# 应该看到类似的输出:
# SSE connection established
# Initialization progress: {state: "CREATING_PROJECT", progress: 10}
# Initialization progress: {state: "LOADING_TEMPLATE", progress: 30}
# ...
# Initialization completed
```

## 环境变量检查

确保以下环境变量已配置:
```bash
# K3s 连接
K3S_API_URL=https://your-k3s-server:6443
K3S_TOKEN=your-k3s-token

# 或使用 kubeconfig
KUBECONFIG=/path/to/kubeconfig

# Git OAuth
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITLAB_CLIENT_ID=xxx
GITLAB_CLIENT_SECRET=xxx
```
