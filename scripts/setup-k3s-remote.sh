#!/bin/bash

# K3s 远程访问配置脚本
# 用法: ./scripts/setup-k3s-remote.sh <服务器IP>

set -e

SERVER_IP=$1

if [ -z "$SERVER_IP" ]; then
    echo "❌ 错误: 请提供服务器 IP 地址"
    echo "用法: ./scripts/setup-k3s-remote.sh <服务器IP>"
    exit 1
fi

echo "🚀 开始配置 K3s 远程访问..."
echo "服务器 IP: $SERVER_IP"
echo ""

# 步骤 1: 创建 .kube 目录
echo "📁 步骤 1: 创建 kubeconfig 目录..."
mkdir -p ~/.kube

# 步骤 2: 从服务器获取 kubeconfig
echo "📥 步骤 2: 从服务器获取 kubeconfig..."
echo "请输入服务器 root 密码:"
ssh root@$SERVER_IP "cat /etc/rancher/k3s/k3s.yaml" > ~/.kube/k3s-remote-temp.yaml

if [ ! -f ~/.kube/k3s-remote-temp.yaml ]; then
    echo "❌ 错误: 无法获取 kubeconfig"
    exit 1
fi

# 步骤 3: 修改 server 地址
echo "🔧 步骤 3: 修改 kubeconfig 配置..."
sed "s/127.0.0.1/$SERVER_IP/g" ~/.kube/k3s-remote-temp.yaml > ~/.kube/k3s-remote.yaml
rm ~/.kube/k3s-remote-temp.yaml

# 添加 insecure-skip-tls-verify
sed -i '' 's/certificate-authority-data:.*/insecure-skip-tls-verify: true/g' ~/.kube/k3s-remote.yaml 2>/dev/null || \
sed -i 's/certificate-authority-data:.*/insecure-skip-tls-verify: true/g' ~/.kube/k3s-remote.yaml

echo "✅ kubeconfig 已保存到: ~/.kube/k3s-remote.yaml"
echo ""

# 步骤 4: 测试连接
echo "🧪 步骤 4: 测试 K3s 连接..."
export KUBECONFIG=~/.kube/k3s-remote.yaml

if command -v kubectl &> /dev/null; then
    echo "测试 kubectl 连接..."
    if kubectl get nodes 2>/dev/null; then
        echo "✅ kubectl 连接成功！"
        echo ""
        echo "节点列表:"
        kubectl get nodes
        echo ""
        echo "Flux 状态:"
        kubectl get pods -n flux-system
    else
        echo "⚠️  kubectl 连接失败"
        echo "可能的原因:"
        echo "1. 服务器防火墙未开放 6443 端口"
        echo "2. 云服务器安全组未配置"
        echo "3. K3s 服务未运行"
    fi
else
    echo "⚠️  kubectl 未安装，跳过连接测试"
    echo "安装 kubectl: https://kubernetes.io/docs/tasks/tools/"
fi

echo ""
echo "📝 步骤 5: 配置环境变量..."
echo ""
echo "请在项目根目录的 .env 文件中添加或修改以下配置:"
echo ""
echo "# K3s 远程访问配置"
echo "K3S_KUBECONFIG_PATH=~/.kube/k3s-remote.yaml"
echo "K3S_SKIP_TLS_VERIFY=true"
echo ""

# 步骤 6: 检查防火墙
echo "🔥 步骤 6: 检查服务器防火墙..."
echo "正在检查服务器 6443 端口..."

if nc -zv $SERVER_IP 6443 2>&1 | grep -q "succeeded\|open"; then
    echo "✅ 端口 6443 已开放"
else
    echo "⚠️  端口 6443 未开放或无法访问"
    echo ""
    echo "请在服务器上执行以下命令开放端口:"
    echo ""
    echo "# 使用 ufw"
    echo "sudo ufw allow 6443/tcp"
    echo ""
    echo "# 使用 firewalld"
    echo "sudo firewall-cmd --permanent --add-port=6443/tcp"
    echo "sudo firewall-cmd --reload"
    echo ""
    echo "# 云服务器（阿里云、腾讯云等）"
    echo "需要在安全组中添加规则：允许 TCP 6443 端口"
fi

echo ""
echo "✅ 配置完成！"
echo ""
echo "下一步:"
echo "1. 确保服务器防火墙已开放 6443 端口"
echo "2. 在 .env 文件中添加上述配置"
echo "3. 重启开发服务器: bun run dev"
echo "4. 创建测试项目验证 GitOps 功能"
echo ""
