# 🚀 Juanie DevOps 平台快速开始检查清单

## ✅ 你已完成

- [x] 创建项目

## 📋 接下来要做的事

### 第一步: 连接代码仓库 (5分钟)

```bash
□ 进入项目详情页
□ 点击"仓库"标签
□ 选择"连接现有仓库"或"创建新仓库"
□ 提供 GitHub/GitLab 访问令牌
□ 保存并验证连接
```

**提示**: 如果没有访问令牌，去 GitHub Settings → Developer settings → Personal access tokens 创建一个

---

### 第二步: 创建环境 (3分钟)

```bash
□ 进入项目详情页
□ 点击"环境"标签
□ 创建开发环境:
  - 名称: dev
  - 类型: development
  - 命名空间: <项目名>-dev
□ (可选) 创建生产环境:
  - 名称: prod
  - 类型: production
  - 命名空间: <项目名>-prod
```

---

### 第三步: 准备 GitOps 仓库 (10分钟)

#### 3.1 创建 GitOps 仓库

```bash
□ 在 GitHub/GitLab 创建新仓库: <项目名>-gitops
□ 克隆到本地
```

#### 3.2 创建基础配置

```bash
mkdir -p base overlays/dev

# 创建 Deployment
cat > base/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: nginx:latest  # 替换为你的镜像
        ports:
        - containerPort: 80
EOF

# 创建 Service
cat > base/service.yaml <<'EOF'
apiVersion: v1
kind: Service
metadata:
  name: app
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
EOF

# 创建 Kustomization
cat > base/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml
EOF

# 创建环境覆盖
cat > overlays/dev/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
EOF

# 提交并推送
git add .
git commit -m "Initial GitOps configuration"
git push
```

---

### 第四步: 配置 Flux CD (5分钟)

#### 4.1 检查 Flux 是否已安装

```bash
□ 运行: kubectl get pods -n flux-system
□ 如果没有，需要先安装 Flux
```

#### 4.2 在平台中配置 GitOps

```bash
□ 进入项目详情页
□ 点击"GitOps"标签
□ 点击"配置 GitOps"
□ 填写信息:
  - 仓库 URL: https://github.com/<你的用户名>/<项目名>-gitops
  - 分支: main
  - 路径: overlays/dev
  - 同步间隔: 1m
□ 保存
```

---

### 第五步: 部署应用 (5分钟)

#### 5.1 准备应用镜像

```bash
□ 构建 Docker 镜像
□ 推送到镜像仓库 (Docker Hub / GitHub Container Registry)
```

#### 5.2 更新 GitOps 配置

```bash
□ 修改 overlays/dev/kustomization.yaml
□ 更新 image 为你的镜像
□ 提交并推送
```

#### 5.3 验证部署

```bash
□ 等待 1-2 分钟
□ 运行: kubectl get pods -n <项目名>-dev
□ 检查 Pod 状态是否为 Running
```

---

## 🎯 验证清单

### 基础验证

```bash
□ 项目已创建
□ 代码仓库已连接
□ 至少有一个环境
□ GitOps 仓库已创建
□ Flux 资源已配置
□ 应用已部署
```

### 功能验证

```bash
□ 可以在平台看到项目状态
□ 可以看到部署历史
□ 可以看到 Pod 运行状态
□ 可以访问应用 (如果配置了 Ingress)
```

---

## 🆘 遇到问题？

### 常见问题快速修复

#### 问题 1: Flux 未安装

```bash
# 安装 Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# 安装 Flux 到集群
flux install
```

#### 问题 2: GitRepository 无法连接

```bash
# 检查凭证
kubectl get secret git-credentials -n flux-system

# 如果不存在，创建
kubectl create secret generic git-credentials \
  --from-literal=username=<用户名> \
  --from-literal=password=<token> \
  -n flux-system
```

#### 问题 3: Pod 无法启动

```bash
# 查看 Pod 详情
kubectl describe pod <pod-name> -n <命名空间>

# 查看日志
kubectl logs <pod-name> -n <命名空间>

# 常见原因:
# - 镜像拉取失败 (检查镜像名称和权限)
# - 资源不足 (检查 CPU/内存限制)
# - 配置错误 (检查环境变量和挂载)
```

#### 问题 4: Flux 不同步

```bash
# 手动触发同步
flux reconcile source git <项目名>
flux reconcile kustomization <项目名>-dev

# 查看同步状态
flux get sources git
flux get kustomizations

# 查看日志
flux logs --follow
```

---

## 📚 下一步学习

完成基础部署后，你可以：

1. **配置 CI/CD**: 自动构建和部署
2. **添加监控**: Prometheus + Grafana
3. **配置告警**: 设置告警规则
4. **多环境部署**: 添加 staging 和 prod 环境
5. **配置 Ingress**: 暴露应用到外网
6. **添加数据库**: 部署 PostgreSQL/MySQL
7. **配置存储**: 使用 PV/PVC 持久化数据

---

## 🎓 推荐阅读

- [完整 DevOps 流程指南](./DEVOPS_WORKFLOW_GUIDE.md)
- [GitOps 最佳实践](https://www.gitops.tech/)
- [Flux CD 文档](https://fluxcd.io/docs/)
- [Kubernetes 基础教程](https://kubernetes.io/docs/tutorials/)

---

## ✨ 成功标志

当你看到以下内容时，说明部署成功：

```bash
$ kubectl get pods -n myproject-dev
NAME                   READY   STATUS    RESTARTS   AGE
app-7d8f9c5b6d-abc12   1/1     Running   0          2m

$ flux get kustomizations
NAME            READY   MESSAGE
myproject-dev   True    Applied revision: main/abc123

$ kubectl get svc -n myproject-dev
NAME   TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
app    ClusterIP   10.43.123.456   <none>        80/TCP    2m
```

恭喜！你的应用已经成功部署到 Kubernetes 集群了！🎉

---

**需要帮助？** 查看 [完整指南](./DEVOPS_WORKFLOW_GUIDE.md) 或查看平台日志
