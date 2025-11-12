# GitOps UI 操作指南

本指南详细介绍如何通过 Web UI 使用 GitOps 功能。

## 目录

- [GitOps 设置页面](#gitops-设置页面)
- [GitOps 资源管理](#gitops-资源管理)
- [可视化部署](#可视化部署)
- [配置编辑器](#配置编辑器)
- [部署历史和回滚](#部署历史和回滚)
- [监控和告警](#监控和告警)

---

## GitOps 设置页面

### 访问设置

导航路径：**项目 → 设置 → GitOps**

### Flux 管理

#### 安装 Flux

1. 点击 **安装 Flux** 按钮
2. 选择安装选项：
   - **命名空间**: 默认 `flux-system`
   - **版本**: 选择 Flux 版本（推荐使用最新稳定版）
3. 点击 **确认安装**
4. 等待安装完成（约 30-60 秒）

#### 查看 Flux 状态

安装完成后，状态卡片会显示：

```
Flux 状态: ✅ 健康

组件状态:
- source-controller: ✅ Ready (1/1)
- kustomize-controller: ✅ Ready (1/1)
- helm-controller: ✅ Ready (1/1)
- notification-controller: ✅ Ready (1/1)
```

#### 升级 Flux

1. 点击 **检查更新** 按钮
2. 如果有新版本，会显示版本对比
3. 点击 **升级** 按钮
4. 系统会自动备份当前配置并升级

#### 卸载 Flux

⚠️ **警告**: 卸载 Flux 会停止所有 GitOps 自动化部署。

1. 点击 **卸载 Flux** 按钮
2. 确认操作
3. 选择是否删除命名空间

---

## GitOps 资源管理

### 访问资源列表

导航路径：**项目 → GitOps 资源**

### 创建 Kustomization 资源

#### 基础配置

1. 点击 **创建 GitOps 资源** 按钮
2. 选择类型：**Kustomization**
3. 填写基本信息：
   - **名称**: 资源名称（如 `my-app-prod`）
   - **命名空间**: K8s 命名空间（如 `default`）
   - **环境**: 选择目标环境
   - **仓库**: 选择 Git 仓库

#### 高级配置

**路径配置:**

```
配置路径: ./k8s/overlays/production
```

**同步设置:**

- **同步间隔**: 5m（5 分钟检查一次）
- **超时时间**: 3m（3 分钟超时）
- **重试间隔**: 1m（失败后 1 分钟重试）

**Prune 设置:**

- ✅ **启用 Prune**: 自动删除 Git 中不存在的资源
- ⚠️ 生产环境建议关闭，避免误删除

**健康检查:**

添加需要检查的资源：

```yaml
- API 版本: apps/v1
  类型: Deployment
  名称: my-app
  
- API 版本: v1
  类型: Service
  名称: my-app
```

**依赖关系:**

如果此资源依赖其他资源，添加依赖：

```yaml
依赖资源:
- 名称: database
  命名空间: default
```

Flux 会确保依赖资源先部署成功。

#### 保存并应用

1. 点击 **创建** 按钮
2. 系统会：
   - 在数据库中创建记录
   - 生成 Flux YAML
   - 应用到 K3s 集群
3. 跳转到资源详情页

### 创建 HelmRelease 资源

#### 基础配置

1. 选择类型：**HelmRelease**
2. 填写基本信息（同上）

#### Helm 特定配置

**Chart 配置:**

```
Chart 名称: my-app
Chart 版本: 1.0.0
源类型: GitRepository
源名称: my-repo
```

**Values 配置:**

使用 YAML 编辑器或可视化表单配置 Helm values：

```yaml
replicaCount: 3

image:
  repository: ghcr.io/org/my-app
  tag: v1.0.0
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

**升级策略:**

```yaml
安装配置:
  - 失败重试次数: 3
  - 自动创建命名空间: 是

升级配置:
  - 失败重试次数: 3
  - 修复上次失败: 是
  - 失败时清理: 是
```

### 查看资源详情

点击资源名称进入详情页，可以看到：

#### 状态概览

```
状态: ✅ Ready
最后应用版本: main@sha1:abc123
最后尝试版本: main@sha1:abc123
最后同步时间: 2 分钟前
```

#### 条件信息

```
Ready: True
  原因: ReconciliationSucceeded
  消息: Applied revision: main@sha1:abc123
  
Healthy: True
  原因: HealthCheckSucceeded
  消息: All health checks passed
```

#### 事件历史

```
[2024-01-15 10:30:00] Normal - ReconciliationSucceeded
  Applied revision: main@sha1:abc123
  
[2024-01-15 10:29:30] Normal - ArtifactUpdated
  Fetched revision: main@sha1:abc123
  
[2024-01-15 10:29:00] Normal - ReconciliationStarted
  Reconciliation started
```

#### 配置详情

查看完整的 Flux YAML 配置。

### 编辑资源

1. 点击 **编辑** 按钮
2. 修改配置
3. 点击 **保存**
4. Flux 会自动应用新配置

### 手动触发同步

如果不想等待自动同步间隔：

1. 点击 **手动同步** 按钮
2. Flux 会立即检查 Git 并同步
3. 查看同步结果

### 暂停/恢复同步

暂停自动同步（用于维护）：

1. 点击 **暂停同步** 按钮
2. 资源状态变为 "Suspended"
3. Flux 不会自动同步此资源

恢复同步：

1. 点击 **恢复同步** 按钮
2. Flux 立即执行一次同步

### 删除资源

⚠️ **警告**: 删除 GitOps 资源会停止自动同步，但不会删除已部署的 K8s 资源。

1. 点击 **删除** 按钮
2. 确认操作
3. 选择是否同时删除 K8s 资源

---

## 可视化部署

### 打开部署对话框

方式 1: **项目详情页 → 选择环境 → 部署按钮**

方式 2: **部署页面 → 新建部署 → 选择 GitOps 模式**

### 部署表单

#### 镜像配置

**选择镜像版本:**

- 从下拉列表选择（自动获取可用标签）
- 或手动输入完整镜像地址

```
镜像: ghcr.io/org/my-app:v1.2.3
拉取策略: IfNotPresent
```

#### 副本数配置

使用滑块或 +/- 按钮调整：

```
副本数: ▼ 3 ▲
```

#### 环境变量

添加或修改环境变量：

```
NODE_ENV = production
API_URL = https://api.example.com
DATABASE_URL = postgresql://...

[+ 添加变量]
```

支持的变量类型：

- **普通变量**: 直接输入值
- **Secret 引用**: 从 K8s Secret 读取
- **ConfigMap 引用**: 从 ConfigMap 读取

#### 资源限制

配置 CPU 和内存：

```
资源请求:
  CPU: 100m
  内存: 128Mi

资源限制:
  CPU: 500m
  内存: 512Mi
```

#### 健康检查

配置存活探针和就绪探针：

```
存活探针:
  ✅ 启用
  类型: HTTP
  路径: /health
  端口: 8080
  初始延迟: 30 秒
  间隔: 10 秒

就绪探针:
  ✅ 启用
  类型: HTTP
  路径: /ready
  端口: 8080
  初始延迟: 10 秒
  间隔: 5 秒
```

### 预览变更

点击 **预览变更** 按钮，查看：

#### YAML 差异

```diff
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
- replicas: 3
+ replicas: 5
  template:
    spec:
      containers:
      - name: app
-       image: ghcr.io/org/my-app:v1.0.0
+       image: ghcr.io/org/my-app:v1.2.3
```

#### 影响分析

```
变更摘要:
  - 镜像版本: v1.0.0 → v1.2.3
  - 副本数: 3 → 5

影响评估:
  ⚠️ 此变更将导致 Pod 重启
  ⏱️ 预计停机时间: ~30 秒
  👥 影响用户: 约 100 个活跃连接
  
建议:
  - 在低峰时段部署
  - 确保健康检查配置正确
  - 准备回滚计划
```

### Commit 信息

输入 Git commit 信息：

```
Commit 消息: Deploy v1.2.3 to production

详细描述（可选）:
- 修复了登录问题
- 优化了性能
- 更新了依赖
```

系统会自动添加元数据：

```
Deployed via Platform UI by user@example.com
Environment: production
Timestamp: 2024-01-15T10:30:00Z
```

### 确认部署

1. 检查所有配置
2. 点击 **确认部署** 按钮
3. 系统执行：
   - 生成 K8s YAML
   - 创建 Git commit
   - Push 到远程仓库
4. 跳转到部署进度页面

---

## 配置编辑器

### 访问编辑器

导航路径：**项目 → 环境 → 配置编辑器**

### 三种编辑模式

#### 1. 可视化编辑

使用表单编辑配置，适合不熟悉 YAML 的用户。

**容器配置:**

```
镜像: ghcr.io/org/my-app:v1.0.0
拉取策略: [IfNotPresent ▼]
命令: /app/start.sh
参数: --port 8080
```

**端口配置:**

```
容器端口: 8080
协议: TCP
名称: http

[+ 添加端口]
```

**卷挂载:**

```
挂载路径: /data
卷名称: data-volume
只读: ☐

[+ 添加挂载]
```

#### 2. YAML 编辑

使用 Monaco Editor 直接编辑 YAML：

- 语法高亮
- 自动补全
- 错误提示
- 格式化

快捷键：

- `Ctrl+S`: 保存
- `Ctrl+F`: 查找
- `Ctrl+H`: 替换
- `Alt+Shift+F`: 格式化

#### 3. 差异对比

查看你的修改与当前 Git 版本的差异：

- 绿色：新增的行
- 红色：删除的行
- 黄色：修改的行

### 验证配置

点击 **验证 YAML** 按钮，系统会检查：

- ✅ YAML 语法正确性
- ✅ K8s API 版本有效性
- ✅ 必填字段完整性
- ✅ 资源限制合理性

如果有错误，会显示：

```
❌ 第 15 行: spec.replicas 必须是正整数
⚠️ 第 23 行: 建议配置资源限制
ℹ️ 第 30 行: 可以使用更简洁的写法
```

### 保存并提交

1. 输入 commit 消息
2. 点击 **保存并提交到 Git**
3. 系统会：
   - 验证配置
   - 创建 Git commit
   - Push 到远程仓库
   - Flux 自动同步

---

## 部署历史和回滚

### 查看部署历史

导航路径：**项目 → 部署历史**

部署列表显示：

```
┌─────────────────────────────────────────────────────────┐
│ v1.2.3  ✅ 成功  2024-01-15 10:30  gitops-ui  user@...  │
│ Git: abc123 "Deploy v1.2.3 to production"               │
├─────────────────────────────────────────────────────────┤
│ v1.2.2  ✅ 成功  2024-01-14 15:20  gitops-git  dev@...  │
│ Git: def456 "feat: add new feature"                     │
├─────────────────────────────────────────────────────────┤
│ v1.2.1  ❌ 失败  2024-01-14 10:00  gitops-ui  user@...  │
│ 错误: ImagePullBackOff                                  │
└─────────────────────────────────────────────────────────┘
```

### 查看部署详情

点击部署记录，查看：

#### 基本信息

```
版本: v1.2.3
状态: ✅ 成功
部署方式: gitops-ui
部署者: user@example.com
开始时间: 2024-01-15 10:30:00
完成时间: 2024-01-15 10:32:30
耗时: 2 分 30 秒
```

#### Git 信息

```
Commit: abc123def456
消息: Deploy v1.2.3 to production
分支: main
作者: user@example.com
时间: 2024-01-15 10:30:00

[查看 Commit] [查看差异]
```

#### 变更内容

```
变更文件:
  - k8s/overlays/production/deployment.yaml
  - k8s/overlays/production/service.yaml

变更摘要:
  - 镜像版本: v1.2.2 → v1.2.3
  - 副本数: 3 → 5
  - 环境变量: 新增 API_URL
```

#### 部署日志

```
[10:30:00] 开始部署...
[10:30:05] Git commit 已创建: abc123
[10:30:10] Flux 检测到变更
[10:30:30] 开始应用 Kustomization
[10:31:00] Deployment 已更新
[10:31:30] 等待 Pod 就绪...
[10:32:00] 5/5 Pods 就绪
[10:32:30] 健康检查通过
[10:32:30] ✅ 部署成功
```

### 回滚部署

#### 快速回滚

1. 在部署历史中找到目标版本
2. 点击 **回滚** 按钮
3. 确认操作
4. 系统会：
   - 创建回滚 commit
   - Push 到 Git
   - Flux 自动应用

#### 高级回滚

1. 点击 **高级回滚** 按钮
2. 选择回滚选项：
   - ☐ 仅回滚镜像版本
   - ☐ 回滚所有配置
   - ☐ 回滚环境变量
3. 输入回滚原因
4. 确认回滚

---

## 监控和告警

### GitOps 仪表板

导航路径：**项目 → 监控 → GitOps**

#### 同步状态概览

```
┌─────────────────────────────────────┐
│ GitOps 资源总数: 12                  │
│ ✅ 健康: 10                          │
│ 🟡 同步中: 1                         │
│ ❌ 失败: 1                           │
└─────────────────────────────────────┘
```

#### 同步成功率

图表显示过去 24 小时的同步成功率：

```
100% ┤     ╭─────────────────
 90% ┤   ╭─╯
 80% ┤ ╭─╯
     └─────────────────────────
     0h  6h  12h  18h  24h
```

#### 同步延迟

显示 Git commit 到部署完成的平均时间：

```
平均延迟: 2 分 15 秒
P50: 1 分 30 秒
P95: 4 分 20 秒
P99: 8 分 10 秒
```

### 配置告警

#### 创建告警规则

1. 进入 **设置 → 告警规则**
2. 点击 **新建规则**
3. 配置规则：

```
规则名称: Flux 同步失败告警

条件:
  - GitOps 资源状态 = Failed
  - 持续时间 > 5 分钟

通知渠道:
  ✅ 邮件
  ✅ 应用内通知
  ☐ Slack
  ☐ 钉钉

接收人:
  - user@example.com
  - team-lead@example.com
```

#### 告警模板

系统提供预定义模板：

- **Flux 组件异常**: Flux 组件 Pod 重启或不健康
- **同步失败**: GitOps 资源同步失败超过 3 次
- **同步延迟**: 同步延迟超过 10 分钟
- **Git 认证失败**: Git 仓库认证失败

### 查看告警历史

导航路径：**监控 → 告警历史**

```
┌──────────────────────────────────────────────────────┐
│ 🔴 严重 - Flux 同步失败                               │
│ 资源: my-app-prod                                     │
│ 原因: ImagePullBackOff                                │
│ 时间: 2024-01-15 10:30:00                             │
│ 状态: 已解决                                          │
├──────────────────────────────────────────────────────┤
│ 🟡 警告 - 同步延迟过高                                │
│ 资源: my-app-staging                                  │
│ 延迟: 12 分钟                                         │
│ 时间: 2024-01-14 15:20:00                             │
│ 状态: 进行中                                          │
└──────────────────────────────────────────────────────┘
```

---

## 最佳实践

### 1. 环境配置建议

**开发环境:**

- ✅ 启用自动同步
- ✅ 同步间隔: 1 分钟
- ✅ 启用 Prune
- ❌ 不需要审批

**生产环境:**

- ❌ 关闭自动同步（手动触发）
- ✅ 同步间隔: 10 分钟
- ❌ 关闭 Prune（避免误删除）
- ✅ 需要审批

### 2. 部署前检查清单

- ☐ 在开发环境测试通过
- ☐ 查看变更预览
- ☐ 确认影响范围
- ☐ 准备回滚计划
- ☐ 通知相关人员

### 3. 命名规范

**GitOps 资源命名:**

```
格式: {app-name}-{environment}
示例: my-app-prod, my-app-staging
```

**Commit 消息格式:**

```
类型(范围): 简短描述

详细描述

类型: feat, fix, chore, docs, style, refactor
范围: deploy, config, infra
```

### 4. 安全建议

- 🔒 使用 SSH 密钥而不是密码
- 🔒 定期轮换 Git 凭证
- 🔒 限制生产环境的部署权限
- 🔒 启用审批流程
- 🔒 记录所有操作到审计日志

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `G` + `D` | 跳转到部署页面 |
| `G` + `R` | 跳转到 GitOps 资源页面 |
| `N` | 新建部署 |
| `R` | 刷新当前页面 |
| `/` | 搜索 |
| `?` | 显示快捷键帮助 |

---

## 相关文档

- [GitOps 快速入门](./QUICK_START.md)
- [Git 工作流指南](./GIT_WORKFLOW.md)
- [故障排查指南](./TROUBLESHOOTING.md)
- [API 参考文档](../api/gitops/API_REFERENCE.md)
