# 故障排查指南

## 概述

本指南帮助您诊断和解决项目管理系统中的常见问题。

---

## 项目初始化问题

### 问题 1: 项目初始化失败 - Git 仓库创建失败

**症状：**
```
❌ 项目初始化失败
错误: Git 仓库创建失败: 访问令牌权限不足
步骤: 创建 Git 仓库 (40%)
```

**可能原因：**
1. Git 访问令牌权限不足
2. 访问令牌已过期
3. 仓库名称已存在
4. Git 提供商 API 限流

**解决方法：**

**方法 1: 检查访问令牌权限**

GitHub Token 需要以下权限：
```
✅ repo (完整仓库访问)
✅ admin:repo_hook (管理 webhooks)
✅ workflow (如果使用 GitHub Actions)
```

GitLab Token 需要以下权限：
```
✅ api (完整 API 访问)
✅ write_repository (写仓库)
```

**方法 2: 重新生成访问令牌**

1. 访问 Git 提供商的设置页面
2. 删除旧的 Token
3. 创建新的 Token 并确保权限正确
4. 在项目设置中更新 Token

**方法 3: 检查仓库名称**

```bash
# 检查仓库是否已存在
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/YOUR_ORG/YOUR_REPO

# 如果返回 200，说明仓库已存在
# 解决方法: 使用不同的仓库名称或删除现有仓库
```

**方法 4: 重试初始化**

在项目详情页面，点击 **"重新初始化"** 按钮。

---

### 问题 2: 项目初始化失败 - K8s 配置提交失败

**症状：**
```
❌ 项目初始化失败
错误: Git 提交失败: 推送被拒绝
步骤: 提交配置到 Git (70%)
```

**可能原因：**
1. Git 分支受保护
2. 没有推送权限
3. 仓库为空且没有初始提交

**解决方法：**

**方法 1: 检查分支保护规则**

```bash
# GitHub: 检查分支保护
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/YOUR_ORG/YOUR_REPO/branches/main/protection

# 如果分支受保护，临时禁用或添加例外
```

**方法 2: 检查推送权限**

确保访问令牌有推送权限：
- GitHub: `repo` 权限
- GitLab: `write_repository` 权限

**方法 3: 初始化仓库**

如果仓库为空：

```bash
# 手动初始化仓库
git clone YOUR_REPO_URL
cd YOUR_REPO
echo "# My Project" > README.md
git add README.md
git commit -m "Initial commit"
git push origin main

# 然后重新初始化项目
```

---

### 问题 3: 项目初始化失败 - GitOps 资源创建失败

**症状：**
```
❌ 项目初始化失败
错误: Flux 资源创建失败: Kustomization 验证失败
步骤: 创建 GitOps 资源 (90%)
```

**可能原因：**
1. Flux 未安装或未运行
2. K8s 配置语法错误
3. 命名空间不存在
4. RBAC 权限不足

**解决方法：**

**方法 1: 检查 Flux 状态**

```bash
# 检查 Flux 是否运行
kubectl get pods -n flux-system

# 应该看到:
# NAME                                       READY   STATUS
# source-controller-xxx                      1/1     Running
# kustomize-controller-xxx                   1/1     Running
# helm-controller-xxx                        1/1     Running
# notification-controller-xxx                1/1     Running

# 如果 Pod 不是 Running 状态，检查日志
kubectl logs -n flux-system deployment/kustomize-controller
```

**方法 2: 验证 K8s 配置**

```bash
# 手动验证 Kustomization
kubectl apply --dry-run=client -f k8s/overlays/development/kustomization.yaml

# 检查语法错误
```

**方法 3: 检查命名空间**

```bash
# 检查命名空间是否存在
kubectl get namespace YOUR_NAMESPACE

# 如果不存在，创建命名空间
kubectl create namespace YOUR_NAMESPACE
```

**方法 4: 检查 RBAC 权限**

```bash
# 检查 Flux 的 ServiceAccount 权限
kubectl get clusterrolebinding | grep flux

# 确保 Flux 有足够的权限创建资源
```

---

## 部署问题

### 问题 4: 部署失败 - 镜像拉取失败

**症状：**
```
❌ 部署失败
Pod 状态: ImagePullBackOff
错误: Failed to pull image "myorg/myapp:v1.0.0": unauthorized
```

**可能原因：**
1. 镜像不存在
2. 镜像仓库需要认证
3. ImagePullSecret 未配置

**解决方法：**

**方法 1: 检查镜像是否存在**

```bash
# 检查镜像
docker pull myorg/myapp:v1.0.0

# 如果失败，检查镜像名称和标签是否正确
```

**方法 2: 配置 ImagePullSecret**

```bash
# 创建 Docker Registry Secret
kubectl create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_PASSWORD \
  --docker-email=YOUR_EMAIL \
  -n YOUR_NAMESPACE

# 在 Deployment 中引用 Secret
spec:
  template:
    spec:
      imagePullSecrets:
      - name: regcred
```

**方法 3: 使用公共镜像仓库**

如果使用私有仓库有问题，可以临时使用公共仓库测试。

---

### 问题 5: 部署失败 - Pod 启动失败

**症状：**
```
❌ 部署失败
Pod 状态: CrashLoopBackOff
错误: Back-off restarting failed container
```

**可能原因：**
1. 应用启动错误
2. 环境变量配置错误
3. 健康检查失败
4. 资源不足

**解决方法：**

**方法 1: 查看 Pod 日志**

```bash
# 查看 Pod 日志
kubectl logs -n YOUR_NAMESPACE POD_NAME

# 查看上一次运行的日志
kubectl logs -n YOUR_NAMESPACE POD_NAME --previous

# 常见错误:
# - 数据库连接失败
# - 环境变量缺失
# - 端口冲突
# - 依赖服务不可用
```

**方法 2: 检查环境变量**

```bash
# 查看 Pod 的环境变量
kubectl exec -n YOUR_NAMESPACE POD_NAME -- env

# 检查是否缺少必需的环境变量
# 在项目设置中添加缺失的环境变量
```

**方法 3: 调整健康检查**

```yaml
# 增加健康检查的延迟和超时
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 60  # 增加到 60 秒
  periodSeconds: 10
  timeoutSeconds: 10       # 增加超时时间
  failureThreshold: 5      # 增加失败阈值
```

**方法 4: 检查资源限制**

```bash
# 查看 Pod 的资源使用
kubectl top pod -n YOUR_NAMESPACE POD_NAME

# 如果接近限制，增加资源配额
resources:
  requests:
    cpu: "500m"      # 增加 CPU
    memory: "512Mi"  # 增加内存
  limits:
    cpu: "2000m"
    memory: "2Gi"
```

---

### 问题 6: 部署失败 - GitOps 同步失败

**症状：**
```
❌ 部署失败
GitOps 状态: Failed
错误: Kustomization reconciliation failed
```

**可能原因：**
1. Git 仓库不可访问
2. K8s 配置语法错误
3. 资源冲突
4. Flux 权限不足

**解决方法：**

**方法 1: 检查 Kustomization 状态**

```bash
# 查看 Kustomization 状态
kubectl get kustomization -n flux-system

# 查看详细错误
kubectl describe kustomization -n flux-system YOUR_KUSTOMIZATION

# 常见错误:
# - Git repository not found
# - Invalid YAML syntax
# - Resource already exists
```

**方法 2: 检查 Git 仓库访问**

```bash
# 检查 GitRepository 状态
kubectl get gitrepository -n flux-system

# 查看详细信息
kubectl describe gitrepository -n flux-system YOUR_REPO

# 如果认证失败，更新 Secret
kubectl create secret generic git-credentials \
  --from-literal=username=YOUR_USERNAME \
  --from-literal=password=YOUR_TOKEN \
  -n flux-system \
  --dry-run=client -o yaml | kubectl apply -f -
```

**方法 3: 手动验证 K8s 配置**

```bash
# 克隆仓库
git clone YOUR_REPO_URL
cd YOUR_REPO

# 验证 Kustomization
kubectl kustomize k8s/overlays/development

# 如果有错误，修复后提交
git add .
git commit -m "Fix kustomization"
git push
```

**方法 4: 强制重新同步**

```bash
# 强制 Flux 重新同步
flux reconcile kustomization YOUR_KUSTOMIZATION --with-source

# 或者在 UI 中点击 "强制同步" 按钮
```

---

## 健康度问题

### 问题 7: 健康度评分低

**症状：**
```
⚠️ 项目健康度: 45 (警告)

问题:
- 部署成功率: 60% (低于 80%)
- GitOps 同步: 降级
- Pod 健康: 降级
```

**可能原因：**
1. 频繁的部署失败
2. GitOps 同步问题
3. Pod 不健康

**解决方法：**

**方法 1: 分析部署失败原因**

```bash
# 查看最近的部署记录
# 在 UI 中: 项目详情 → 部署 Tab → 筛选失败的部署

# 常见失败原因:
# - 镜像拉取失败 → 检查镜像和认证
# - 启动失败 → 检查日志和环境变量
# - 健康检查失败 → 调整健康检查配置
# - 资源不足 → 增加资源配额
```

**方法 2: 修复 GitOps 同步问题**

参考 [问题 6: GitOps 同步失败](#问题-6-部署失败---gitops-同步失败)

**方法 3: 修复不健康的 Pod**

```bash
# 查看不健康的 Pod
kubectl get pods -n YOUR_NAMESPACE | grep -v Running

# 查看 Pod 详情
kubectl describe pod -n YOUR_NAMESPACE POD_NAME

# 常见问题:
# - CrashLoopBackOff → 查看日志
# - ImagePullBackOff → 检查镜像
# - Pending → 检查资源和调度
# - Error → 查看事件
```

---

## 审批问题

### 问题 8: 审批通知未收到

**症状：**
```
部署已提交审批，但审批人未收到通知
```

**可能原因：**
1. 通知服务未配置
2. 邮件被拦截
3. Slack/钉钉集成失败

**解决方法：**

**方法 1: 检查通知服务配置**

```bash
# 检查通知服务状态
kubectl get pods -n YOUR_NAMESPACE | grep notification

# 查看通知服务日志
kubectl logs -n YOUR_NAMESPACE deployment/notification-service

# 检查环境变量
kubectl exec -n YOUR_NAMESPACE POD_NAME -- env | grep SMTP
```

**方法 2: 检查邮件配置**

```yaml
# 在项目设置中检查 SMTP 配置
SMTP 设置:
  服务器: smtp.gmail.com
  端口: 587
  用户名: your-email@gmail.com
  密码: ********
  发件人: noreply@example.com
  
测试: [发送测试邮件]
```

**方法 3: 检查 Slack 集成**

```yaml
# 在项目设置中检查 Slack 配置
Slack 设置:
  Webhook URL: https://hooks.slack.com/services/...
  频道: #deployments
  
测试: [发送测试消息]
```

**方法 4: 手动通知审批人**

如果自动通知失败，可以手动通知：
1. 复制审批链接
2. 通过其他渠道发送给审批人

---

### 问题 9: 审批超时

**症状：**
```
⏰ 审批超时
部署已自动拒绝（24 小时未响应）
```

**可能原因：**
1. 审批人不在
2. 审批人未收到通知
3. 超时时间设置过短

**解决方法：**

**方法 1: 配置备用审批人**

```yaml
审批设置:
  审批人:
    - Alice (主要)
    - Bob (备用)
  规则: 任意一人批准即可
```

**方法 2: 调整超时时间**

```yaml
审批设置:
  超时时间: 48 小时  # 增加到 48 小时
  超时提醒: 提前 4 小时提醒
```

**方法 3: 重新提交审批**

1. 在项目详情页面找到超时的部署
2. 点击 **"重新提交"** 按钮
3. 系统会创建新的审批请求

---

## 性能问题

### 问题 10: 项目列表加载慢

**症状：**
```
项目列表页面加载超过 10 秒
```

**可能原因：**
1. 项目数量过多
2. 健康度计算耗时
3. 数据库查询慢

**解决方法：**

**方法 1: 启用分页**

```typescript
// 在项目列表中启用分页
const { data, isLoading } = useProjects({
  page: 1,
  pageSize: 20,  // 每页 20 个项目
})
```

**方法 2: 使用缓存**

```typescript
// 缓存健康度数据
const healthCache = new Map()

async function getProjectHealth(projectId: string) {
  const cached = healthCache.get(projectId)
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.data  // 5 分钟内使用缓存
  }
  
  const health = await calculateHealth(projectId)
  healthCache.set(projectId, { data: health, timestamp: Date.now() })
  return health
}
```

**方法 3: 优化数据库查询**

```sql
-- 添加索引
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_health_status ON projects(health_status);

-- 使用查询优化
EXPLAIN ANALYZE SELECT * FROM projects WHERE organization_id = 'xxx';
```

---

## 数据问题

### 问题 11: 项目数据不一致

**症状：**
```
项目详情页面显示的环境数量与实际不符
```

**可能原因：**
1. 数据同步延迟
2. 缓存未更新
3. 数据库事务失败

**解决方法：**

**方法 1: 刷新页面**

按 `Ctrl+F5` 强制刷新页面，清除浏览器缓存。

**方法 2: 手动同步数据**

在项目详情页面，点击 **"同步数据"** 按钮。

**方法 3: 检查数据库**

```sql
-- 检查项目的环境
SELECT * FROM environments WHERE project_id = 'YOUR_PROJECT_ID';

-- 检查项目的 GitOps 资源
SELECT * FROM gitops_resources WHERE project_id = 'YOUR_PROJECT_ID';

-- 如果数据不一致，可能需要重新初始化
```

---

## 获取帮助

### 查看日志

**应用日志：**

```bash
# API Gateway 日志
kubectl logs -n YOUR_NAMESPACE deployment/api-gateway --tail=100

# Projects Service 日志
kubectl logs -n YOUR_NAMESPACE deployment/projects-service --tail=100

# Flux 日志
kubectl logs -n flux-system deployment/kustomize-controller --tail=100
```

**审计日志：**

在项目详情页面的 **"审计日志"** Tab 中查看所有操作记录。

### 诊断工具

**健康检查：**

```bash
# 检查系统健康状态
curl http://localhost:3000/health

# 应该返回:
{
  "status": "healthy",
  "services": {
    "database": "healthy",
    "queue": "healthy",
    "flux": "healthy"
  }
}
```

**连接测试：**

```bash
# 测试数据库连接
kubectl exec -n YOUR_NAMESPACE deployment/api-gateway -- \
  node -e "require('./dist/main').testDatabaseConnection()"

# 测试 Git 连接
kubectl exec -n YOUR_NAMESPACE deployment/api-gateway -- \
  node -e "require('./dist/main').testGitConnection('YOUR_REPO_URL', 'YOUR_TOKEN')"
```

### 联系支持

如果问题仍未解决：

1. **收集信息：**
   - 错误消息
   - 相关日志
   - 操作步骤
   - 环境信息

2. **提交工单：**
   - 邮件: support@example.com
   - Slack: #devops-support
   - GitHub Issue: https://github.com/your-org/your-repo/issues

3. **提供详细信息：**
   ```
   问题描述: 项目初始化失败
   
   环境信息:
   - 项目 ID: proj-456
   - 组织 ID: org-123
   - 模板: react-app
   
   错误信息:
   Git 仓库创建失败: 访问令牌权限不足
   
   已尝试的解决方法:
   - 重新生成访问令牌
   - 检查权限配置
   
   日志:
   [附加相关日志]
   ```

---

## 相关文档

- [项目创建指南](./PROJECT_CREATION_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)
- [健康度监控说明](./HEALTH_MONITORING_GUIDE.md)
- [API 参考文档](../api/projects/PROJECT_API.md)
