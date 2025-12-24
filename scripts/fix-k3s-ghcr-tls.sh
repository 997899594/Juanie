#!/bin/bash
# 修复 K3s 节点的 ghcr.io TLS 证书问题

set -e

K3S_HOST="49.232.237.136"
K3S_USER="root"

echo "=== 修复 K3s ghcr.io TLS 证书问题 ==="
echo "目标节点: $K3S_USER@$K3S_HOST"
echo ""

# 创建远程执行脚本
cat > /tmp/fix-ghcr-remote.sh <<'REMOTE_SCRIPT'
#!/bin/bash
set -e

echo "📦 1/4 更新 CA 证书..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates

echo "🔄 2/4 刷新证书..."
update-ca-certificates --fresh

echo "⏰ 3/4 同步系统时间..."
DEBIAN_FRONTEND=noninteractive apt-get install -y ntp
ntpdate -u pool.ntp.org || true
timedatectl set-ntp true || true

echo "🚀 4/4 重启服务..."
systemctl restart containerd
systemctl restart k3s

echo ""
echo "⏳ 等待 K3s 就绪..."
sleep 15

echo ""
echo "✅ 修复完成！"
echo ""
echo "系统时间: $(date)"
echo "K3s 状态: $(systemctl is-active k3s)"
REMOTE_SCRIPT

# 上传并执行
echo "📤 上传修复脚本到 K3s 节点..."
scp -o StrictHostKeyChecking=no /tmp/fix-ghcr-remote.sh $K3S_USER@$K3S_HOST:/tmp/

echo ""
echo "🔧 执行修复..."
ssh -o StrictHostKeyChecking=no $K3S_USER@$K3S_HOST 'bash /tmp/fix-ghcr-remote.sh'

echo ""
echo "✅ 远程修复完成！"
echo ""
echo "现在验证项目 11444a 的 Pod..."

# 删除旧 Pod，让 K8s 重新创建
kubectl --kubeconfig=.kube/k3s-remote.yaml delete pod --all \
  -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development \
  --ignore-not-found=true

echo ""
echo "⏳ 等待新 Pod 创建..."
sleep 10

echo ""
echo "📊 Pod 状态:"
kubectl --kubeconfig=.kube/k3s-remote.yaml get pods \
  -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development

echo ""
echo "🎉 完成！请等待 30 秒后检查 Pod 是否成功拉取镜像"
