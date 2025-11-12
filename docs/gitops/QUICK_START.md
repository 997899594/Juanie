# GitOps 快速入门指南

欢迎使用 AI DevOps 平台的 GitOps 功能！本指南将帮助你在 5 分钟内开始使用 GitOps 进行自动化部署。

## 什么是 GitOps？

GitOps 是一种使用 Git 作为单一真实来源的运维模式。简单来说：

- ✅ **所有配置都存储在 Git 中** - 可追溯、可回滚
- ✅ **自动化部署** - Git 变更自动触发部署
- ✅ **声明式配置** - 描述"想要什么"而不是"如何做"

## 双向 GitOps 的优势

我们的平台支持**双向 GitOps**，这意味着：

### 方式 1: UI 优先（推荐新手）

```
你在 UI 中点击按钮 → 平台自动创建 Git commit → Flux 自动部署
```

**优点：** 无需了解 Git 或 YAML，像使用传统平台一样简单！

### 方式 2: Git 优先（推荐开发者）

```
你 push 代码到 Git → Flux 检测变更 → 自动部署到 K3s
```

**优点：** 使用熟悉的 Git 工作流，完全掌控！

### 方式 3: 混合模式

两种方式可以同时使用，团队成员可以选择自己喜欢的方式！

---

## 第一步：安装 Flux

### 1.1 检查前置条件

确保你的项目已经：

- ✅ 连接了 K3s 集群
- ✅ 有一个 Git 仓库（GitHub、GitLab 或 Gitea）
- ✅ 有项目管理员权限

### 1.2 安装 Flux

1. 进入项目设置页面
2. 点击 **GitOps** 标签
3. 点击 **安装 Flux** 按钮
4. 等待安装完成（约 30 秒）

![安装 Flux](./images/install-flux.png)

### 1.3 验证安装

安装完成后，你会看到 Flux 组件状态：

- ✅ source-controller: Ready
- ✅ kustomize-controller: Ready
- ✅ helm-controller: Ready
- ✅ notification-controller: Ready

---

## 第二步：启用 GitOps

### 2.1 为仓库启用 GitOps

1. 进入 **仓库** 页面
2. 找到你的项目仓库
3. 点击 **启用 GitOps** 开关
4. 配置同步间隔（推荐 1 分钟）

![启用 GitOps](./images/enable-gitops.png)

### 2.2 配置环境

为每个环境配置 GitOps 设置：

**开发环境（自动同步）：**

```yaml
Git 分支: develop
配置路径: ./k8s/overlays/development
自动同步: 开启
同步间隔: 1 分钟
```

**生产环境（手动同步）：**

```yaml
Git 分支: main
配置路径: ./k8s/overlays/production
自动同步: 关闭（需要审批）
同步间隔: 10 分钟
```

---

## 第三步：第一次部署

### 方式 A: 通过 UI 部署（推荐新手）

#### 3.1 打开部署对话框

1. 进入项目详情页
2. 选择环境（如"开发环境"）
3. 点击 **部署** 按钮

#### 3.2 配置部署参数

在可视化表单中配置：

- **镜像版本**: 选择或输入镜像标签（如 `v1.0.0`）
- **副本数**: 调整 Pod 数量（如 `3`）
- **环境变量**: 添加或修改环境变量
- **资源限制**: 配置 CPU 和内存

![部署对话框](./images/deploy-dialog.png)

#### 3.3 预览变更

点击 **预览变更** 查看：

- YAML 差异对比
- 影响分析（是否重启 Pod、预计停机时间）
- Git commit 信息

#### 3.4 确认部署

1. 输入 commit 消息（可选，系统会自动生成）
2. 点击 **确认部署**
3. 系统会：
   - 生成 K8s YAML 文件
   - 创建 Git commit
   - Push 到远程仓库
   - Flux 自动检测并部署

#### 3.5 查看进度

部署后会跳转到进度页面，显示 4 个步骤：

1. ✅ Git Commit 已创建
2. 🔄 Flux 同步中...
3. ⏳ 应用到 K8s
4. ⏳ 健康检查

![部署进度](./images/deploy-progress.png)

---

### 方式 B: 通过 Git 部署（推荐开发者）

#### 3.1 准备 K8s 配置

在你的 Git 仓库中创建目录结构：

```
my-project/
├── k8s/
│   ├── base/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   └── overlays/
│       ├── development/
│       │   ├── kustomization.yaml
│       │   └── patch.yaml
│       └── production/
│           ├── kustomization.yaml
│           └── patch.yaml
```

#### 3.2 编写 Deployment

`k8s/base/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: ghcr.io/org/my-app:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: production
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
```

#### 3.3 提交并推送

```bash
git add k8s/
git commit -m "feat: add kubernetes manifests"
git push origin main
```

#### 3.4 自动部署

Flux 会在 1 分钟内检测到变更并自动部署！

在平台 UI 中，你会看到：

- 新的部署记录（部署方式：`gitops-git`）
- Git commit 信息和链接
- 实时部署状态

---

## 第四步：日常使用

### 更新镜像版本

**UI 方式：**

1. 点击 **部署** 按钮
2. 选择新的镜像版本
3. 点击 **确认部署**

**Git 方式：**

```bash
# 编辑 deployment.yaml
vim k8s/base/deployment.yaml

# 修改镜像标签
# image: ghcr.io/org/my-app:v1.0.0
# 改为
# image: ghcr.io/org/my-app:v1.1.0

git commit -am "chore: update to v1.1.0"
git push
```

### 调整副本数

**UI 方式：**

1. 点击 **部署** 按钮
2. 使用 +/- 按钮调整副本数
3. 点击 **确认部署**

**Git 方式：**

```yaml
# k8s/overlays/production/patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 5  # 从 3 改为 5
```

### 修改环境变量

**UI 方式：**

1. 点击 **部署** 按钮
2. 在环境变量区域添加或修改
3. 点击 **确认部署**

**Git 方式：**

```yaml
# k8s/base/deployment.yaml
env:
- name: NODE_ENV
  value: production
- name: API_URL
  value: https://api.example.com  # 新增
```

---

## 第五步：监控和故障排查

### 查看 GitOps 资源状态

1. 进入 **GitOps 资源** 页面
2. 查看所有 Kustomization 和 HelmRelease
3. 状态指示：
   - 🟢 Ready - 同步成功
   - 🟡 Reconciling - 同步中
   - 🔴 Failed - 同步失败

### 手动触发同步

如果自动同步失败，可以手动触发：

1. 找到对应的 GitOps 资源
2. 点击 **手动同步** 按钮
3. 等待同步完成

### 查看 Flux 事件

在 **GitOps 资源详情** 页面，可以看到：

- 最近的同步事件
- 错误消息和建议
- Git commit 历史

### 常见问题

**Q: 为什么我的部署一直显示"Reconciling"？**

A: 检查以下几点：
1. Git 仓库是否可访问（检查凭证）
2. YAML 语法是否正确（使用 **验证 YAML** 功能）
3. K8s 资源是否有错误（查看 Flux 事件）

**Q: 如何回滚到之前的版本？**

A: 两种方式：
1. UI 方式：在部署历史中点击 **回滚** 按钮
2. Git 方式：`git revert <commit-sha>` 然后 push

**Q: 可以同时使用 UI 和 Git 部署吗？**

A: 可以！两种方式完全兼容。UI 部署会创建 Git commit，Git 部署会在 UI 中显示。

---

## 下一步

恭喜！你已经掌握了 GitOps 的基本使用。接下来可以：

- 📖 阅读 [UI 操作指南](./UI_GUIDE.md) 了解高级功能
- 📖 阅读 [Git 工作流指南](./GIT_WORKFLOW.md) 学习最佳实践
- 📖 阅读 [故障排查指南](./TROUBLESHOOTING.md) 解决常见问题
- 📖 查看 [API 参考文档](../api/gitops/API_REFERENCE.md) 进行自动化集成

---

## 获取帮助

如果遇到问题：

1. 查看 [故障排查指南](./TROUBLESHOOTING.md)
2. 查看 Flux 事件日志
3. 联系平台管理员
4. 提交 Issue 到项目仓库

祝你使用愉快！🚀
