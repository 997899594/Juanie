#!/bin/bash
# 新服务器初始化脚本
# 使用方法: ./deploy/flux/scripts/init-server.sh

set -e

echo "=========================================="
echo "Juanie 服务器初始化脚本"
echo "=========================================="

# 检查并安装 Flux（使用代理）
if ! command -v flux &> /dev/null; then
    echo "Flux 未安装，正在安装（使用代理）..."
    curl -L -o /tmp/flux.tar.gz "https://gh-proxy.com/https://github.com/fluxcd/flux2/releases/download/v2.8.1/flux_2.8.1_linux_amd64.tar.gz"
    tar xzf /tmp/flux.tar.gz -C /tmp
    sudo mv /tmp/flux /usr/local/bin/flux
    sudo chmod +x /usr/local/bin/flux
    rm /tmp/flux.tar.gz
    echo "Flux 安装完成: $(flux --version)"
fi

# 检查 kubectl context
echo ""
echo "当前 Kubernetes context:"
kubectl config current-context

read -p "确认继续? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# 1. 安装 Flux 组件
echo ""
echo "=== 1. 安装 Flux 组件 ==="
flux install

# 2. 等待 Flux 组件就绪
echo ""
echo "=== 2. 等待 Flux 组件就绪 ==="
flux check

# 3. 创建 GitRepository（使用代理 URL）
echo ""
echo "=== 3. 创建 GitRepository ==="
kubectl apply -f - <<EOF
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 10m0s
  url: https://gh-proxy.com/https://github.com/997899594/Juanie.git
  ref:
    branch: main
EOF

# 4. 创建 infrastructure Kustomization
echo ""
echo "=== 4. 创建 Infrastructure Kustomization ==="
kubectl apply -f - <<EOF
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: infrastructure
  namespace: flux-system
spec:
  interval: 10m0s
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./deploy/flux/infrastructure
  prune: true
  wait: true
  timeout: 5m0s
EOF

# 5. 创建 apps Kustomization
echo ""
echo "=== 5. 创建 Apps Kustomization ==="
kubectl apply -f - <<EOF
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 10m0s
  dependsOn:
    - name: infrastructure
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./deploy/flux/apps/base
  prune: true
  wait: true
  timeout: 10m0s
EOF

# 6. SOPS 密钥提示
echo ""
echo "=== 6. SOPS 密钥配置 ==="
echo "请手动执行以下命令来配置 SOPS 密钥:"
echo ""
echo "  # 1. 生成 age 密钥 (如果没有)"
echo "  age-keygen -o age.key"
echo ""
echo "  # 2. 创建 Kubernetes Secret"
echo "  kubectl create secret generic sops-age -n flux-system --from-file=age.agekey=./age.key"
echo ""
echo "  # 3. 安全存储 age.key (不要提交到 Git!)"
echo "  mv age.key ~/.config/sops/age/keys.txt"
echo ""

# 7. 验证部署
echo ""
echo "=== 7. 验证部署 ==="
echo "等待 30 秒让 Flux 开始同步..."
sleep 30

echo ""
echo "GitRepositories:"
flux get sources git

echo ""
echo "Kustomizations:"
flux get kustomizations

echo ""
echo "Helm Releases:"
flux get helmreleases -A

echo ""
echo "Pods:"
kubectl get pods -A | grep -E "juanie|flux|NAME"

echo ""
echo "=========================================="
echo "初始化完成!"
echo "=========================================="
