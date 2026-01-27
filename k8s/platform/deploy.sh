#!/bin/bash

# Juanie Platform K8s 部署脚本
# 使用方式: ./deploy.sh [环境] [操作]
# 环境: dev | production (默认: production)
# 操作: apply | delete | diff | build | push (默认: apply)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."
ENV="${1:-production}"
ACTION="${2:-apply}"

# K3s 远程 kubeconfig
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/k3s-remote.yaml}"
export KUBECONFIG

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."

    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl 未安装"
        exit 1
    fi

    if [ ! -f "$KUBECONFIG" ]; then
        log_error "Kubeconfig 不存在: $KUBECONFIG"
        exit 1
    fi
}

# 检查集群连接
check_cluster() {
    log_info "检查 K3s 集群连接... (using $KUBECONFIG)"

    if ! kubectl cluster-info &> /dev/null; then
        log_error "无法连接到 K3s 集群"
        exit 1
    fi

    log_info "集群连接正常"
}

# 构建 Docker 镜像
build_images() {
    log_step "构建 Docker 镜像..."

    cd "$PROJECT_ROOT"

    # 构建 API Gateway
    log_info "构建 api-gateway 镜像..."
    docker build -t ghcr.io/findbiao/juanie-api-gateway:latest -f apps/api-gateway/Dockerfile .

    # 构建 Web
    log_info "构建 web 镜像..."
    docker build -t ghcr.io/findbiao/juanie-web:latest -f apps/web/Dockerfile .

    log_info "镜像构建完成"
}

# 推送镜像到 GHCR
push_images() {
    log_step "推送镜像到 GHCR..."

    docker push ghcr.io/findbiao/juanie-api-gateway:latest
    docker push ghcr.io/findbiao/juanie-web:latest

    log_info "镜像推送完成"
}

# 部署
deploy() {
    local kustomize_path="$SCRIPT_DIR/overlays/$ENV"

    if [ ! -d "$kustomize_path" ]; then
        log_error "Overlay 不存在: $kustomize_path"
        log_info "可用的 overlays:"
        ls -1 "$SCRIPT_DIR/overlays/"
        exit 1
    fi

    log_info "部署环境: $ENV"
    log_info "Kustomize 路径: $kustomize_path"

    case $ACTION in
        apply)
            log_step "应用配置..."
            kubectl apply -k "$kustomize_path"
            log_info "配置已应用"

            log_step "等待 Deployment 就绪..."
            kubectl rollout status deployment/api-gateway -n juanie-platform --timeout=300s || true
            kubectl rollout status deployment/web -n juanie-platform --timeout=300s || true

            log_step "查看部署状态..."
            kubectl get pods -n juanie-platform
            ;;
        delete)
            log_warn "删除部署..."
            kubectl delete -k "$kustomize_path" || true
            log_info "删除完成"
            ;;
        diff)
            log_step "显示变更..."
            kubectl diff -k "$kustomize_path" || true
            ;;
        *)
            log_error "未知操作: $ACTION"
            exit 1
            ;;
    esac
}

# 显示访问信息
show_access_info() {
    echo ""
    log_info "========================================="
    log_info "  部署完成!"
    log_info "========================================="
    echo ""
    echo "访问地址:"
    echo "  Web:  https://juanie.art"
    echo "  API:  https://api.juanie.art"
    echo ""

    # 获取 Ingress IP
    INGRESS_IP=$(kubectl get ingress -n juanie-platform juanie-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "待分配")
    echo "Ingress IP: $INGRESS_IP"
    echo ""
    log_info "确保 DNS 已配置:"
    echo "  juanie.art     -> $INGRESS_IP"
    echo "  api.juanie.art -> $INGRESS_IP"
    echo ""
    log_info "查看状态命令:"
    echo "  kubectl -n juanie-platform get pods"
    echo "  kubectl -n juanie-platform get ingress"
    echo "  kubectl -n juanie-platform logs -f deployment/api-gateway"
}

# 使用帮助
show_help() {
    echo ""
    echo "Juanie Platform K8s 部署脚本"
    echo ""
    echo "用法: $0 [环境] [操作]"
    echo ""
    echo "环境:"
    echo "  dev         开发环境 (低资源)"
    echo "  production  生产环境 (默认)"
    echo ""
    echo "操作:"
    echo "  apply   应用部署 (默认)"
    echo "  delete  删除部署"
    echo "  diff    预览变更"
    echo "  build   构建 Docker 镜像"
    echo "  push    推送镜像到 GHCR"
    echo ""
    echo "示例:"
    echo "  $0                     # 部署到生产环境"
    echo "  $0 dev apply           # 部署到开发环境"
    echo "  $0 production diff     # 预览生产环境变更"
    echo "  $0 production build    # 构建镜像"
    echo ""
}

# 主函数
main() {
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_help
        exit 0
    fi

    echo ""
    log_info "========================================="
    log_info "  Juanie Platform K8s 部署"
    log_info "========================================="
    echo ""

    check_dependencies

    if [ "$ACTION" = "build" ]; then
        build_images
        exit 0
    fi

    if [ "$ACTION" = "push" ]; then
        build_images
        push_images
        exit 0
    fi

    check_cluster
    deploy

    if [ "$ACTION" = "apply" ]; then
        show_access_info
    fi
}

main "$@"
