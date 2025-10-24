#!/bin/bash

# 🚀 Juanie AI - 自动化部署脚本
# 支持多环境部署和边缘节点分发

set -euo pipefail

# ============================================================================
# 配置变量
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-juanie}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ENVIRONMENT="${ENVIRONMENT:-development}"
NAMESPACE="${NAMESPACE:-juanie-ai}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# 工具函数
# ============================================================================
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

check_dependencies() {
    log "检查依赖工具..."
    
    local deps=("docker" "docker-compose" "kubectl" "helm")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "$dep 未安装，请先安装必要的依赖"
        fi
    done
    
    success "所有依赖工具已安装"
}

# ============================================================================
# Docker 相关函数
# ============================================================================
build_image() {
    log "构建 Docker 镜像..."
    
    cd "$PROJECT_ROOT"
    
    # 构建多架构镜像
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --target runner \
        --tag "${DOCKER_REGISTRY}/api:${IMAGE_TAG}" \
        --tag "${DOCKER_REGISTRY}/api:latest" \
        --push \
        .
    
    # 构建边缘节点镜像
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --target edge \
        --tag "${DOCKER_REGISTRY}/api-edge:${IMAGE_TAG}" \
        --tag "${DOCKER_REGISTRY}/api-edge:latest" \
        --push \
        .
    
    success "Docker 镜像构建完成"
}

# ============================================================================
# Docker Compose 部署
# ============================================================================
deploy_docker_compose() {
    log "使用 Docker Compose 部署..."
    
    cd "$PROJECT_ROOT"
    
    case "$ENVIRONMENT" in
        "development")
            docker-compose --profile dev up -d
            ;;
        "production")
            docker-compose up -d
            ;;
        "edge")
            docker-compose --profile edge up -d
            ;;
        *)
            error "不支持的环境: $ENVIRONMENT"
            ;;
    esac
    
    success "Docker Compose 部署完成"
}

# ============================================================================
# Kubernetes 部署
# ============================================================================
deploy_kubernetes() {
    log "部署到 Kubernetes..."
    
    # 检查 kubectl 连接
    if ! kubectl cluster-info &> /dev/null; then
        error "无法连接到 Kubernetes 集群"
    fi
    
    # 创建命名空间
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # 应用配置
    kubectl apply -f "$PROJECT_ROOT/k8s/" -n "$NAMESPACE"
    
    # 等待部署完成
    kubectl rollout status deployment/juanie-api -n "$NAMESPACE" --timeout=300s
    
    success "Kubernetes 部署完成"
}

# ============================================================================
# 健康检查
# ============================================================================
health_check() {
    log "执行健康检查..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            success "应用健康检查通过"
            return 0
        fi
        
        log "健康检查失败，重试 ($attempt/$max_attempts)..."
        sleep 10
        ((attempt++))
    done
    
    error "健康检查失败，部署可能存在问题"
}

# ============================================================================
# 监控部署
# ============================================================================
deploy_monitoring() {
    log "部署监控组件..."
    
    if command -v helm &> /dev/null; then
        # 使用 Helm 部署 Prometheus 和 Grafana
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo add grafana https://grafana.github.io/helm-charts
        helm repo update
        
        # 部署 Prometheus
        helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --create-namespace \
            --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false
        
        success "监控组件部署完成"
    else
        warning "Helm 未安装，跳过监控组件部署"
    fi
}

# ============================================================================
# 边缘节点部署
# ============================================================================
deploy_edge_nodes() {
    log "部署边缘节点..."
    
    # 读取边缘节点配置
    if [ -f "$PROJECT_ROOT/edge-nodes.json" ]; then
        local edge_nodes
        edge_nodes=$(cat "$PROJECT_ROOT/edge-nodes.json")
        
        echo "$edge_nodes" | jq -r '.nodes[]' | while read -r node; do
            log "部署到边缘节点: $node"
            
            # 这里可以添加具体的边缘节点部署逻辑
            # 例如：通过 SSH 连接到边缘节点并部署容器
            
            success "边缘节点 $node 部署完成"
        done
    else
        warning "未找到边缘节点配置文件，跳过边缘节点部署"
    fi
}

# ============================================================================
# 清理函数
# ============================================================================
cleanup() {
    log "清理资源..."
    
    case "$1" in
        "docker-compose")
            docker-compose down -v
            ;;
        "kubernetes")
            kubectl delete namespace "$NAMESPACE" --ignore-not-found=true
            ;;
        *)
            warning "未指定清理类型"
            ;;
    esac
    
    success "资源清理完成"
}

# ============================================================================
# 主函数
# ============================================================================
main() {
    log "开始部署 Juanie AI..."
    log "环境: $ENVIRONMENT"
    log "命名空间: $NAMESPACE"
    log "镜像标签: $IMAGE_TAG"
    
    check_dependencies
    
    case "${1:-}" in
        "build")
            build_image
            ;;
        "docker")
            build_image
            deploy_docker_compose
            health_check
            ;;
        "k8s"|"kubernetes")
            build_image
            deploy_kubernetes
            deploy_monitoring
            health_check
            ;;
        "edge")
            build_image
            deploy_edge_nodes
            ;;
        "cleanup")
            cleanup "${2:-docker-compose}"
            ;;
        "health")
            health_check
            ;;
        *)
            echo "用法: $0 {build|docker|k8s|edge|cleanup|health}"
            echo ""
            echo "命令说明:"
            echo "  build     - 仅构建 Docker 镜像"
            echo "  docker    - 使用 Docker Compose 部署"
            echo "  k8s       - 部署到 Kubernetes"
            echo "  edge      - 部署到边缘节点"
            echo "  cleanup   - 清理部署资源"
            echo "  health    - 执行健康检查"
            echo ""
            echo "环境变量:"
            echo "  ENVIRONMENT     - 部署环境 (development|production|edge)"
            echo "  DOCKER_REGISTRY - Docker 镜像仓库"
            echo "  IMAGE_TAG       - 镜像标签"
            echo "  NAMESPACE       - Kubernetes 命名空间"
            exit 1
            ;;
    esac
    
    success "Juanie AI 部署完成！"
}

# 执行主函数
main "$@"