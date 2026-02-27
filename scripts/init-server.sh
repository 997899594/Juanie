#!/bin/bash
# 新服务器初始化脚本
# 使用方法: ./scripts/init-server.sh

set -e

echo "=========================================="
echo "Juanie 服务器初始化脚本"
echo "=========================================="

# 检查是否已安装 flux
if ! command -v flux &> /dev/null; then
    echo "Flux 未安装，请先安装 Flux CLI"
    echo "   curl -s https://fluxcd.io/install.sh | sudo bash"
    exit 1
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

# 1. Bootstrap Flux
echo ""
echo "=== 1. Bootstrap Flux ==="
echo "请在浏览器中完成 GitHub 授权..."
flux bootstrap github \
  --owner=997899594 \
  --repository=Juanie \
  --path=clusters/production \
  --personal

# 2. 等待 Flux 组件就绪
echo ""
echo "=== 2. 等待 Flux 组件就绪 ==="
flux check

# 3. SOPS 密钥提示
echo ""
echo "=== 3. SOPS 密钥配置 ==="
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

# 4. 验证部署
echo ""
echo "=== 4. 验证部署 ==="
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
echo ""
echo "后续步骤:"
echo "  1. 配置 SOPS 密钥 (见上方说明)"
echo "  2. 更新 secrets/charts/juanie/templates/secret.yaml 中的敏感值"
echo "  3. 运行: sops --encrypt --in-place charts/juanie/templates/secret.yaml"
echo "  4. 提交并推送: git add . && git commit -m 'chore: 更新加密密钥' && git push"
echo ""
