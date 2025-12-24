# K3s 集群清理和项目 11444a 状态

**日期**: 2024-12-24  
**操作**: 清理 K3s 集群中的旧项目，保留项目 11444a

## 执行的操作

### 1. 集群清理

使用脚本 `scripts/cleanup-k3s-pods-fast.sh` 批量删除了 51 个旧项目的命名空间：

```bash
./scripts/cleanup-k3s-pods-fast.sh
```

**清理结果**:
- ✅ 删除了 51 个命名空间（17 个项目 × 3 个环境）
- ✅ 保留了项目 11444a 的 3 个环境命名空间
- ✅ 释放了大量集群资源

**保留的命名空间**:
- `project-a5ca948d-2db3-437e-8504-bc7cc956013e-development`
- `project-a5ca948d-2db3-437e-8504-bc7cc956013e-staging`
- `project-a5ca948d-2db3-437e-8504-bc7cc956013e-production`

### 2. 项目 11444a 状态

**项目信息**:
- ID: `a5ca948d-2db3-437e-8504-bc7cc956013e`
- 名称: `11444a`
- 状态: `active`
- 初始化: ✅ 已完成（2024-12-23 18:01:34）

**初始化步骤**:
1. ✅ `create_repository` - 创建 GitHub 仓库
2. ✅ `push_template` - 推送模板代码
3. ✅ `create_database_records` - 创建数据库记录
4. ✅ `setup_gitops` - 设置 GitOps 资源
5. ✅ `finalize` - 完成初始化

## 当前问题

### Pod 状态: ImagePullBackOff

**问题描述**:
```
Status: ImagePullBackOff
Image: ghcr.io/997899594/11444a:latest
```

**错误信息**:
```
Failed to pull image: failed to verify certificate: 
x509: certificate is valid for *.github.io, *.github.com, 
*.githubusercontent.com, github.com, github.io, 
githubusercontent.com, www.github.com, not ghcr.io
```

**根本原因**:
K3s 节点的 TLS 证书验证配置问题，无法验证 `ghcr.io` 的证书。

### 解决方案

#### 方案 1: 配置 K3s 跳过 TLS 验证（临时方案）

在 K3s 节点上配置 containerd 跳过 ghcr.io 的 TLS 验证：

```bash
# SSH 到 K3s 节点
ssh root@your-k3s-node

# 编辑 containerd 配置
cat >> /etc/rancher/k3s/registries.yaml <<EOF
mirrors:
  ghcr.io:
    endpoint:
      - "https://ghcr.io"
configs:
  "ghcr.io":
    tls:
      insecure_skip_verify: true
EOF

# 重启 K3s
systemctl restart k3s
```

#### 方案 2: 更新 CA 证书（推荐）

```bash
# SSH 到 K3s 节点
ssh root@your-k3s-node

# 更新 CA 证书
apt-get update
apt-get install -y ca-certificates
update-ca-certificates

# 重启 K3s
systemctl restart k3s
```

#### 方案 3: 使用私有镜像仓库

配置项目使用支持的镜像仓库（如 Docker Hub 或阿里云容器镜像服务）。

## 验证步骤

清理完成后，验证集群状态：

```bash
# 查看所有项目命名空间
kubectl --kubeconfig=.kube/k3s-remote.yaml get namespaces | grep "^project-"

# 查看项目 11444a 的 Pod
kubectl --kubeconfig=.kube/k3s-remote.yaml get pods \
  -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development

# 查看 Pod 详情
kubectl --kubeconfig=.kube/k3s-remote.yaml describe pod \
  -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development
```

## 集群资源状态

清理前:
- 命名空间: 54 个项目命名空间
- 问题: 内存不足，Pod 无法调度

清理后:
- 命名空间: 3 个项目命名空间（仅 11444a）
- 状态: ✅ 内存充足，Pod 可以调度
- 剩余问题: 镜像拉取 TLS 证书验证失败

## 相关脚本

- `scripts/check-project-11444a.ts` - 检查项目数据库状态
- `scripts/cleanup-k3s-pods-fast.sh` - 快速清理 K3s 命名空间
- `scripts/check-k3s-project-11444a.ts` - 检查 K3s 集群状态（需要修复）

## 下一步

1. 修复 K3s 节点的 TLS 证书问题（选择上述方案之一）
2. 重启 Pod 验证镜像拉取成功
3. 检查应用是否正常运行
4. 配置 Ingress 访问应用

## 参考

- [K3s Private Registry Configuration](https://docs.k3s.io/installation/private-registry)
- [Containerd Registry Configuration](https://github.com/containerd/containerd/blob/main/docs/hosts.md)
