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

# 1. 配置 Git 代理
echo ""
echo "=== 1. 配置 Git 代理 ==="
git config --global http.https://github.com.proxy https://gh-proxy.com
git config --global http.https://gh-proxy.com.proxy ""
echo "Git 代理配置完成"

# 2. Bootstrap Flux
echo ""
echo "=== 2. Bootstrap Flux ==="
echo "请在浏览器中完成 GitHub 授权..."
flux bootstrap github \
  --owner=997899594 \
  --repository=Juanie \
  --path=deploy/flux/clusters/production \
  --personal

# 3. 等待 Flux 组件就绪
echo ""
echo "=== 3. 等待 Flux 组件就绪 ==="
flux check

# 4. SOPS 密钥提示
echo ""
echo "=== 4. SOPS 密钥配置 ==="
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

# 5. 验证部署
echo ""
echo "=== 5. 验证部署 ==="
echo "等待 30 秒让 Flux 开始同步..."
sleep 30

echo ""
echo "Kustomizations:"
flux get kustomizations

echo ""
echo "Helm Releases:"
flux get helmreleases -A

echo ""
echo "Pods:"
kubectl get pods -n juanie

echo ""
echo "=========================================="
echo "初始化完成!"
echo "=========================================="
