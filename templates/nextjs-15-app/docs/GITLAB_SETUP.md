# GitLab CI/CD 配置指南

本文档说明如何在 GitLab（包括私有服务器）上配置 CI/CD。

## 📋 前置要求

### GitLab.com
- GitLab 账户
- 项目仓库

### 私有 GitLab 服务器
- GitLab 服务器访问权限
- GitLab Runner 已配置
- Docker Registry（可选，推荐使用 GitLab Container Registry）

---

## 🔧 配置步骤

### 1. 配置 CI/CD 变量

在 GitLab 项目中设置以下变量：

**Settings → CI/CD → Variables**

#### 必需变量

```bash
# GitOps 仓库访问令牌
GITOPS_TOKEN
# 类型: Variable
# 保护: Yes
# 遮罩: Yes
# 值: 你的 GitLab Personal Access Token (scope: api, write_repository)

# 应用 URL（可选，用于构建时）
NEXT_PUBLIC_APP_URL
# 类型: Variable
# 保护: No
# 遮罩: No
# 值: https://{{ .appName }}.com
```

#### 可选变量（如果使用外部 Registry）

```bash
# 自定义 Docker Registry
REGISTRY
# 值: registry.example.com

# Registry 用户名
REGISTRY_USER
# 值: your-username

# Registry 密码
REGISTRY_PASSWORD
# 类型: Variable
# 保护: Yes
# 遮罩: Yes
# 值: your-password
```

### 2. 配置 GitLab Runner

#### 使用 GitLab.com
GitLab.com 提供共享 Runner，无需额外配置。

#### 私有 GitLab 服务器

**安装 GitLab Runner**

```bash
# Ubuntu/Debian
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
sudo apt-get install gitlab-runner

# 或使用 Docker
docker run -d --name gitlab-runner --restart always \
  -v /srv/gitlab-runner/config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:latest
```

**注册 Runner**

```bash
sudo gitlab-runner register \
  --url https://gitlab.example.com \
  --registration-token YOUR_REGISTRATION_TOKEN \
  --executor docker \
  --docker-image alpine:latest \
  --description "docker-runner" \
  --docker-privileged
```

### 3. 配置 Container Registry

#### 使用 GitLab Container Registry（推荐）

GitLab 内置 Container Registry，无需额外配置。

镜像会自动推送到：
```
registry.gitlab.com/your-group/your-project
```

#### 使用私有 Registry

**在 .gitlab-ci.yml 中配置：**

```yaml
variables:
  REGISTRY: registry.example.com
  IMAGE_NAME: registry.example.com/group/project

build-image:
  before_script:
    - docker login -u $REGISTRY_USER -p $REGISTRY_PASSWORD $REGISTRY
```

### 4. 创建 GitOps 仓库

```bash
# 在 GitLab 上创建新项目
# 项目名称: {{ .appName }}-gitops

# 克隆并初始化
git clone https://gitlab.example.com/your-group/{{ .appName }}-gitops.git
cd {{ .appName }}-gitops

# 复制 K8s 配置
cp -r .k8s/* .
git add .
git commit -m "Initial GitOps configuration"
git push origin main
```

### 5. 配置 Flux CD

```bash
# 创建 GitRepository
flux create source git {{ .appName }} \
  --url=https://gitlab.example.com/your-group/{{ .appName }}-gitops.git \
  --branch=main \
  --interval=1m \
  --secret-ref=gitlab-credentials

# 创建 Secret（如果是私有仓库）
kubectl create secret generic gitlab-credentials \
  --from-literal=username=oauth2 \
  --from-literal=password=YOUR_GITLAB_TOKEN \
  -n flux-system

# 创建 Kustomization
flux create kustomization {{ .appName }}-dev \
  --source=GitRepository/{{ .appName }} \
  --path=./overlays/dev \
  --prune=true \
  --interval=5m \
  --target-namespace={{ .appName }}-dev
```

---

## 🚀 使用 CI/CD

### 触发构建

```bash
# 推送到 develop 分支 → 自动部署到开发环境
git push origin develop

# 推送到 main 分支 → 构建镜像，手动部署到生产
git push origin main
```

### Pipeline 阶段

1. **Prepare** - 安装依赖
2. **Test** - 代码检查、类型检查、单元测试
3. **Build** - 构建 Docker 镜像
4. **Deploy** - 部署到 K8s
5. **Cleanup** - 清理旧镜像

### 手动部署

在 GitLab UI 中：
1. 进入 **CI/CD → Pipelines**
2. 选择要部署的 Pipeline
3. 点击 **deploy:staging** 或 **deploy:prod**
4. 点击 **Play** 按钮

---

## 🔒 私有 GitLab 服务器特殊配置

### 1. 自签名证书

如果使用自签名 SSL 证书：

```bash
# 在 GitLab Runner 配置中添加
sudo gitlab-runner register \
  --tls-ca-file=/path/to/ca.crt

# 或在 config.toml 中
[[runners]]
  [runners.docker]
    tls_verify = false
```

### 2. 内网 Registry

如果 Registry 在内网：

```yaml
# .gitlab-ci.yml
variables:
  REGISTRY: registry.internal.example.com
  
build-image:
  before_script:
    # 添加 insecure registry（仅用于开发）
    - echo '{"insecure-registries":["registry.internal.example.com"]}' > /etc/docker/daemon.json
    - docker login -u $REGISTRY_USER -p $REGISTRY_PASSWORD $REGISTRY
```

### 3. 代理配置

如果需要通过代理访问外网：

```yaml
# .gitlab-ci.yml
variables:
  HTTP_PROXY: http://proxy.example.com:8080
  HTTPS_PROXY: http://proxy.example.com:8080
  NO_PROXY: localhost,127.0.0.1,.example.com
```

---

## 📊 监控 Pipeline

### 查看 Pipeline 状态

```bash
# 使用 GitLab CLI
glab ci status

# 查看最新 Pipeline
glab ci view

# 查看 Job 日志
glab ci trace <job-id>
```

### Pipeline 徽章

在 README.md 中添加：

```markdown
[![Pipeline Status](https://gitlab.example.com/your-group/your-project/badges/main/pipeline.svg)](https://gitlab.example.com/your-group/your-project/-/commits/main)

[![Coverage](https://gitlab.example.com/your-group/your-project/badges/main/coverage.svg)](https://gitlab.example.com/your-group/your-project/-/commits/main)
```

---

## 🐛 故障排查

### Pipeline 失败

**问题：Docker 构建失败**
```bash
# 检查 Runner 是否有 Docker 权限
sudo usermod -aG docker gitlab-runner
sudo systemctl restart gitlab-runner
```

**问题：无法推送镜像**
```bash
# 检查 Registry 认证
docker login registry.gitlab.com
# 或
docker login registry.example.com -u $USER -p $PASSWORD
```

**问题：GitOps 仓库推送失败**
```bash
# 检查 GITOPS_TOKEN 权限
# 需要 api 和 write_repository scope
```

### 部署失败

**问题：Flux 无法同步**
```bash
# 检查 Flux 状态
flux get sources git
flux get kustomizations

# 查看日志
flux logs --follow
```

**问题：镜像拉取失败**
```bash
# 创建 imagePullSecret
kubectl create secret docker-registry gitlab-registry \
  --docker-server=registry.gitlab.com \
  --docker-username=<username> \
  --docker-password=<token> \
  -n {{ .appName }}-dev

# 在 deployment.yaml 中添加
spec:
  template:
    spec:
      imagePullSecrets:
      - name: gitlab-registry
```

---

## 📚 参考资源

- [GitLab CI/CD 文档](https://docs.gitlab.com/ee/ci/)
- [GitLab Runner 文档](https://docs.gitlab.com/runner/)
- [GitLab Container Registry](https://docs.gitlab.com/ee/user/packages/container_registry/)
- [Flux CD 文档](https://fluxcd.io/docs/)

---

## 💡 最佳实践

1. **使用 GitLab Container Registry** - 简化配置，无需额外 Registry
2. **保护敏感变量** - 所有密钥都应设置为 Protected 和 Masked
3. **使用 Environments** - 利用 GitLab Environments 管理部署
4. **启用 Auto DevOps** - 考虑使用 GitLab Auto DevOps 简化配置
5. **定期清理镜像** - 避免 Registry 存储空间耗尽
6. **使用 Merge Request Pipelines** - 在合并前运行测试
7. **配置通知** - 设置 Pipeline 失败通知

---

**配置完成后，你的 GitLab CI/CD 就可以自动构建和部署了！** 🚀
