# 部署测试指南

## 前置条件检查

✅ K3s 集群运行正常
✅ Flux 已安装
✅ 数据库和 Redis 运行中
✅ API 网关和 Web 应用运行中

## 测试步骤

### 1. 启动服务

```bash
# 启动所有服务
bun run dev
```

访问 http://localhost:5173

### 2. 创建测试项目

1. 登录系统
2. 点击"创建项目"
3. 填写项目信息：
   - 项目名称：test-deployment
   - 选择模板：Next.js 15 App
   - 选择环境：Development, Staging, Production
4. 配置 Git 仓库（如果需要）
5. 点击"创建"

### 3. 监控初始化进度

项目创建后会自动初始化：
- ✅ 创建数据库记录
- ✅ 创建环境配置
- ✅ 创建 GitOps 资源（GitRepository + Kustomization）
- ✅ 同步到 K3s 集群

在项目详情页可以看到：
- 初始化进度条
- GitOps 资源状态
- 健康度评分

### 4. 验证 GitOps 资源

```bash
# 查看项目的 namespace
kubectl --kubeconfig ~/.kube/k3s-remote.yaml get ns | grep project-

# 查看 GitOps 资源
kubectl --kubeconfig ~/.kube/k3s-remote.yaml get gitrepositories,kustomizations -A | grep project-

# 查看资源详情
kubectl --kubeconfig ~/.kube/k3s-remote.yaml describe kustomization <name> -n <namespace>
```

### 5. 触发部署

部署会在以下情况自动触发：
- Git 仓库有新的提交
- 手动触发同步（在 GitOps Tab 中）
- Flux 定期同步（默认 1 分钟）

### 6. 查看部署状态

在项目详情页的"部署"Tab 中可以看到：
- 部署历史
- 部署状态
- 部署日志

## 常见问题

### GitOps 资源状态为 pending

**原因**：Git 仓库未配置或无法访问

**解决**：
1. 检查仓库配置是否正确
2. 确保 K3s 可以访问 Git 仓库
3. 查看 Flux 日志：
```bash
kubectl --kubeconfig ~/.kube/k3s-remote.yaml logs -n flux-system -l app=source-controller
```

### 部署失败

**原因**：Kubernetes 资源配置错误

**解决**：
1. 查看 Kustomization 状态
2. 检查 K8s 资源定义
3. 查看 Pod 日志

### 健康度评分低

**原因**：部署失败或 Pod 不健康

**解决**：
1. 查看部署历史
2. 检查 Pod 状态
3. 查看 Pod 日志

## 下一步

- 配置 CI/CD Pipeline
- 设置部署审批流程
- 配置监控告警
- 集成 AI 助手
