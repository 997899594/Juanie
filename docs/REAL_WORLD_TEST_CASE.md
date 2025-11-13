# 真实案例测试 - 完整流程验证

## 测试目标

验证从零开始到成功部署应用的完整流程，确保所有环节都能正常工作。

---

## 案例 1: 部署一个 React 前端应用

### 背景
- 公司：TechCorp
- 团队：前端团队
- 应用：电商平台前端
- 技术栈：React + Nginx
- 环境：开发环境 + 生产环境

### 前置条件
- ✅ K3s 集群已部署（本地或云端）
- ✅ 有集群管理员权限
- ✅ GitHub 账号和仓库
- ✅ GitHub Personal Access Token（repo 权限）

---

### 步骤 1: 首次登录和初始化

#### 1.1 登录系统
```
URL: http://localhost:3000/login
操作: 点击 "使用 GitHub 登录"
预期: 跳转到 GitHub OAuth 授权页面
```

#### 1.2 完成 OAuth 授权
```
操作: 点击 "Authorize"
预期: 
  - 返回到平台
  - 自动创建用户账号
  - 跳转到 /onboarding 页面
```

#### 1.3 快速开始向导 - 欢迎页面
```
页面: /onboarding (步骤 1/4)
显示内容:
  - 欢迎标题
  - 平台功能介绍（GitOps、快速部署、安全可靠）
  - 3 个功能卡片
操作: 点击 "下一步"
```

#### 1.4 快速开始向导 - 安装 Flux
```
页面: /onboarding (步骤 2/4)
显示内容:
  - Flux 介绍
  - "开始安装" 按钮
操作: 点击 "开始安装"
预期:
  - 显示安装进度
  - 日志输出：
    ✓ 正在检查 Kubernetes 集群...
    ✓ 正在下载 Flux 组件...
    ✓ 正在安装 Flux 到集群...
    ✓ 正在验证组件状态...
    ✓ 安装完成！
  - 显示 4 个组件状态（全部就绪）
  - "下一步" 按钮变为可用
```

**验证点：**
```bash
# 在终端验证 Flux 是否安装成功
kubectl get pods -n flux-system

# 预期输出：
NAME                                       READY   STATUS    RESTARTS   AGE
source-controller-xxx                      1/1     Running   0          1m
kustomize-controller-xxx                   1/1     Running   0          1m
helm-controller-xxx                        1/1     Running   0          1m
notification-controller-xxx                1/1     Running   0          1m
```

#### 1.5 快速开始向导 - 创建项目
```
页面: /onboarding (步骤 3/4)
操作:
  1. 选择 "使用模板" 标签
  2. 点击 "React 应用" 卡片
  3. 点击 "创建项目"
预期:
  - 显示加载状态
  - 创建项目成功
  - 自动创建 2 个环境：
    * 开发环境（自动同步）
    * 生产环境（手动同步，需审批）
  - 跳转到步骤 4
```

**验证点：**
```sql
-- 在数据库验证项目是否创建
SELECT * FROM projects WHERE slug = 'react-app';

-- 验证环境是否创建
SELECT * FROM environments WHERE project_id = '<project_id>';

-- 预期：2 条记录（开发环境 + 生产环境）
```

#### 1.6 快速开始向导 - 完成
```
页面: /onboarding (步骤 4/4)
显示内容:
  - 成功图标和庆祝动画
  - 已完成的任务列表
  - 下一步建议（查看项目、连接仓库、查看文档）
操作: 点击 "开始使用"
预期: 跳转到 /projects 页面
```

---

### 步骤 2: 连接 Git 仓库

#### 2.1 准备 Git 仓库
```bash
# 在 GitHub 创建新仓库
仓库名: ecommerce-frontend
可见性: Private
初始化: 添加 README

# 克隆到本地
git clone https://github.com/your-username/ecommerce-frontend.git
cd ecommerce-frontend

# 创建 K8s 配置目录结构
mkdir -p k8s/base
mkdir -p k8s/overlays/development
mkdir -p k8s/overlays/production
```

#### 2.2 创建基础配置
```bash
# k8s/base/deployment.yaml
cat > k8s/base/deployment.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecommerce-frontend
  labels:
    app: ecommerce-frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ecommerce-frontend
  template:
    metadata:
      labels:
        app: ecommerce-frontend
    spec:
      containers:
      - name: frontend
        image: nginx:1.21-alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
EOF

# k8s/base/service.yaml
cat > k8s/base/service.yaml <<EOF
apiVersion: v1
kind: Service
metadata:
  name: ecommerce-frontend
spec:
  selector:
    app: ecommerce-frontend
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
EOF

# k8s/base/kustomization.yaml
cat > k8s/base/kustomization.yaml <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
EOF
```

#### 2.3 创建开发环境配置
```bash
# k8s/overlays/development/deployment.yaml
cat > k8s/overlays/development/deployment.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecommerce-frontend
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: frontend
        env:
        - name: ENV
          value: development
        - name: API_URL
          value: https://api-dev.example.com
EOF

# k8s/overlays/development/kustomization.yaml
cat > k8s/overlays/development/kustomization.yaml <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: default
bases:
  - ../../base
patchesStrategicMerge:
  - deployment.yaml
EOF
```

#### 2.4 创建生产环境配置
```bash
# k8s/overlays/production/deployment.yaml
cat > k8s/overlays/production/deployment.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecommerce-frontend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: frontend
        env:
        - name: ENV
          value: production
        - name: API_URL
          value: https://api.example.com
EOF

# k8s/overlays/production/kustomization.yaml
cat > k8s/overlays/production/kustomization.yaml <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: default
bases:
  - ../../base
patchesStrategicMerge:
  - deployment.yaml
EOF
```

#### 2.5 提交到 Git
```bash
git add .
git commit -m "feat: add kubernetes configurations"
git push origin main

# 创建 develop 分支
git checkout -b develop
git push origin develop
```

#### 2.6 在平台连接仓库
```
页面: /projects/<project-id> → 仓库标签
操作:
  1. 点击 "连接仓库"
  2. 填写表单：
     - 提供商: GitHub
     - 仓库 URL: https://github.com/your-username/ecommerce-frontend
     - 访问令牌: ghp_xxxxxxxxxxxx
     - 默认分支: main
  3. 点击 "连接"
预期:
  - 显示加载状态
  - 连接成功
  - 显示仓库信息
  - 同步状态: 已同步
```

**验证点：**
```sql
-- 验证仓库是否连接
SELECT * FROM repositories WHERE project_id = '<project_id>';

-- 预期：1 条记录，sync_status = 'synced'
```

---

### 步骤 3: 配置 GitOps 资源

#### 3.1 为开发环境创建 Kustomization
```
页面: /projects/<project-id> → GitOps 标签
操作:
  1. 点击 "查看 GitOps 资源"
  2. 跳转到 /gitops/resources?project=<project-id>
  3. 点击 "创建 GitOps 资源"
  4. 填写表单：
     - 类型: Kustomization
     - 名称: ecommerce-frontend-dev
     - 命名空间: default
     - 环境: 开发环境
     - 仓库: ecommerce-frontend
     - 配置路径: ./k8s/overlays/development
     - 同步间隔: 1m
     - 启用 Prune: 是
  5. 点击 "创建"
预期:
  - 创建成功
  - 显示在资源列表中
  - 状态: 同步中 → 就绪
```

**验证点：**
```bash
# 验证 Flux 资源是否创建
kubectl get gitrepository -n flux-system
kubectl get kustomization -n flux-system

# 验证应用是否部署
kubectl get deployment ecommerce-frontend -n default
kubectl get pods -n default | grep ecommerce-frontend

# 预期：Pod 运行正常
```

#### 3.2 为生产环境创建 Kustomization
```
操作: 重复 3.1，但使用以下参数：
  - 名称: ecommerce-frontend-prod
  - 环境: 生产环境
  - 配置路径: ./k8s/overlays/production
  - 同步间隔: 10m
  - 启用 Prune: 否（生产环境更安全）
```

---

### 步骤 4: 通过 UI 部署新版本

#### 4.1 准备新版本镜像
```bash
# 假设我们已经构建了新版本镜像
# 镜像: your-registry/ecommerce-frontend:v1.0.0
```

#### 4.2 通过 UI 部署到开发环境
```
页面: /projects/<project-id> → 部署标签
操作:
  1. 点击 "GitOps 部署"
  2. 选择环境: 开发环境
  3. 填写配置：
     - 镜像: your-registry/ecommerce-frontend:v1.0.0
     - 副本数: 2
     - 环境变量:
       * ENV = development
       * API_URL = https://api-dev.example.com
       * DEBUG = true
     - 资源请求:
       * CPU: 100m
       * 内存: 128Mi
     - 资源限制:
       * CPU: 500m
       * 内存: 512Mi
  4. 切换到 "YAML 预览" 查看生成的配置
  5. 切换到 "变更对比" 查看差异
  6. 输入 Commit 消息: "deploy: update to v1.0.0 in dev"
  7. 点击 "提交部署"
预期:
  - 显示部署进度对话框
  - 4 步进度：
    ✓ Git Commit 创建
    ⏳ Flux 同步（约 1 分钟）
    ⏳ Kubernetes 应用
    ⏳ 健康检查
  - 所有步骤完成后显示 "部署成功"
```

**验证点：**
```bash
# 验证 Git 提交
cd ecommerce-frontend
git pull origin develop
git log -1

# 预期：看到新的 commit "deploy: update to v1.0.0 in dev"

# 验证 K8s 配置已更新
cat k8s/overlays/development/deployment.yaml

# 预期：镜像已更新为 v1.0.0

# 验证 Pod 已更新
kubectl get pods -n default -l app=ecommerce-frontend
kubectl describe pod <pod-name> -n default | grep Image

# 预期：使用新镜像 v1.0.0
```

#### 4.3 查看部署记录
```
页面: /projects/<project-id> → 部署标签
预期显示:
  - 最新部署记录
  - 版本: v1.0.0
  - 状态: 成功
  - 部署方式: GitOps (UI)
  - Git Commit: <commit-sha>
  - 部署时间
  - 可以点击查看详情
```

---

### 步骤 5: 通过 Git Push 部署到生产环境

#### 5.1 合并到 main 分支
```bash
cd ecommerce-frontend

# 切换到 main 分支
git checkout main
git pull origin main

# 合并 develop 分支的变更
git merge develop

# 修改生产环境配置
vim k8s/overlays/production/deployment.yaml

# 更新镜像版本为 v1.0.0
# 更新副本数为 3

# 提交变更
git add .
git commit -m "deploy: update to v1.0.0 in production"
git push origin main
```

#### 5.2 等待 Flux 自动同步
```
时间: 约 10 分钟（根据 syncInterval 配置）

监控方式:
  1. 在平台查看 GitOps 资源状态
     页面: /gitops/resources
     查看: ecommerce-frontend-prod 的状态
  
  2. 在终端查看 Flux 日志
     kubectl logs -n flux-system deployment/kustomize-controller -f
  
  3. 查看 Pod 状态
     kubectl get pods -n default -l app=ecommerce-frontend -w
```

**验证点：**
```bash
# 验证生产环境 Pod 已更新
kubectl get pods -n default -l app=ecommerce-frontend
# 预期：3 个 Pod 运行，使用 v1.0.0 镜像

# 验证部署记录
# 页面: /deployments
# 预期：看到新的部署记录
#   - 版本: v1.0.0
#   - 部署方式: GitOps (Git)
#   - Git Commit: <commit-sha>
```

---

### 步骤 6: 回滚部署

#### 6.1 发现问题
```
假设: v1.0.0 在生产环境出现问题，需要回滚到上一个版本
```

#### 6.2 通过平台回滚
```
页面: /deployments
操作:
  1. 找到上一个成功的部署记录（nginx:1.21-alpine）
  2. 点击 "回滚" 按钮
  3. 确认回滚
预期:
  - 系统自动创建回滚 Commit
  - Push 到 Git
  - Flux 自动检测并应用
  - 部署记录显示回滚操作
```

**验证点：**
```bash
# 验证 Git 历史
git log -2

# 预期：看到回滚 commit

# 验证 Pod 已回滚
kubectl get pods -n default -l app=ecommerce-frontend
kubectl describe pod <pod-name> | grep Image

# 预期：使用旧镜像 nginx:1.21-alpine
```

---

## 案例 2: 部署一个 Node.js API 服务

### 背景
- 应用：用户服务 API
- 技术栈：Node.js + PostgreSQL + Redis
- 需求：数据库连接、环境变量管理、健康检查

### 关键差异点
1. 需要配置数据库连接
2. 需要使用 Secret 管理敏感信息
3. 需要配置健康检查端点
4. 需要配置 Service 和 Ingress

### 测试重点
- Secret 管理
- 多容器 Pod（应用 + Sidecar）
- 健康检查配置
- 服务发现

---

## 案例 3: 微服务应用部署

### 背景
- 应用：电商平台（微服务架构）
- 服务：
  * 前端服务（React）
  * 用户服务（Node.js）
  * 商品服务（Go）
  * 订单服务（Python）
  * API 网关（Nginx）

### 关键差异点
1. 多个服务需要协调部署
2. 服务间依赖关系
3. 统一的配置管理
4. 服务网格集成（可选）

### 测试重点
- 多服务部署顺序
- 依赖关系配置
- 服务间通信
- 统一监控

---

## 测试检查清单

### 功能测试
- [ ] 用户登录和认证
- [ ] Flux 安装和验证
- [ ] 项目创建（模板 + 空白）
- [ ] 环境创建和配置
- [ ] 仓库连接
- [ ] GitOps 资源创建
- [ ] UI 部署
- [ ] Git Push 部署
- [ ] 部署进度追踪
- [ ] 部署历史查看
- [ ] 回滚操作
- [ ] 审批流程（生产环境）

### 集成测试
- [ ] Flux 与 K8s 集成
- [ ] Git 与 Flux 同步
- [ ] 数据库记录一致性
- [ ] 前后端 API 调用
- [ ] WebSocket 实时更新

### 性能测试
- [ ] Flux 同步延迟
- [ ] UI 响应时间
- [ ] 大量资源处理
- [ ] 并发部署

### 安全测试
- [ ] 权限控制
- [ ] Secret 管理
- [ ] 审计日志
- [ ] Git 凭证安全

### 错误处理测试
- [ ] 网络错误
- [ ] Git 认证失败
- [ ] YAML 语法错误
- [ ] 资源不足
- [ ] 镜像拉取失败
- [ ] 健康检查失败

---

## 已知问题和待修复

### 高优先级
1. [ ] Flux 安装需要手动验证集群连接
2. [ ] 部署进度追踪使用轮询，应改为 WebSocket
3. [ ] 错误提示不够友好，需要智能化

### 中优先级
1. [ ] 缺少项目模板的实际文件生成
2. [ ] 缺少 YAML 验证功能
3. [ ] 缺少配置预览的 Diff 高亮

### 低优先级
1. [ ] UI 动画可以更流畅
2. [ ] 文档链接需要完善
3. [ ] 多语言支持

---

## 下一步行动

1. **立即执行**（本周）
   - [ ] 完成 Onboarding 组件的图标导入
   - [ ] 实现 WebSocket 实时部署追踪
   - [ ] 添加 YAML 验证功能

2. **短期计划**（2 周内）
   - [ ] 实现项目模板文件自动生成
   - [ ] 完善错误提示和解决方案
   - [ ] 添加部署预览功能

3. **中期计划**（1 个月内）
   - [ ] 完成所有测试案例
   - [ ] 修复已知问题
   - [ ] 性能优化

---

## 测试结论

通过真实案例测试，我们可以验证：

✅ **流程完整性** - 从登录到部署的完整链路
✅ **功能正确性** - 每个功能都能正常工作
✅ **用户体验** - 流程是否顺畅、直观
✅ **错误处理** - 异常情况是否有合理提示
✅ **性能表现** - 响应时间是否可接受

**当前状态：** 基础流程已打通，但需要真实环境测试和优化。
