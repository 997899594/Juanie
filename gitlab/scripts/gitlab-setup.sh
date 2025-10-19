#!/bin/bash

# GitLab Docker 私服安装和管理脚本
# 使用方法: ./gitlab/scripts/gitlab-setup.sh [start|stop|restart|logs|status|backup|restore]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置文件路径
COMPOSE_FILE="gitlab/docker-compose.yml"
ENV_FILE="gitlab/.env.local"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 和 Docker Compose
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 检查配置文件
check_config() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Docker Compose 配置文件 $COMPOSE_FILE 不存在"
        exit 1
    fi
    
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "环境变量文件 $ENV_FILE 不存在，将使用默认配置"
    fi
}

# 启动 GitLab
start_gitlab() {
    log_info "启动 GitLab 私服..."
    check_dependencies
    check_config
    
    # 创建必要的目录
    mkdir -p gitlab/{config,logs,data}
    
    # 启动服务
    if command -v docker-compose &> /dev/null; then
        docker-compose -f "$COMPOSE_FILE" up -d
    else
        docker compose -f "$COMPOSE_FILE" up -d
    fi
    
    log_success "GitLab 私服启动成功！"
    log_info "访问地址: http://localhost:8080"
    log_info "SSH 克隆端口: 2222"
    log_info "初始管理员用户名: root"
    log_info "初始管理员密码: admin123456"
    log_warning "首次启动可能需要几分钟时间，请耐心等待..."
    
    # 显示启动状态
    show_status
}

# 停止 GitLab
stop_gitlab() {
    log_info "停止 GitLab 私服..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f "$COMPOSE_FILE" down
    else
        docker compose -f "$COMPOSE_FILE" down
    fi
    
    log_success "GitLab 私服已停止"
}

# 重启 GitLab
restart_gitlab() {
    log_info "重启 GitLab 私服..."
    stop_gitlab
    sleep 5
    start_gitlab
}

# 查看日志
show_logs() {
    log_info "显示 GitLab 日志..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f "$COMPOSE_FILE" logs -f gitlab
    else
        docker compose -f "$COMPOSE_FILE" logs -f gitlab
    fi
}

# 显示状态
show_status() {
    log_info "GitLab 服务状态:"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f "$COMPOSE_FILE" ps
    else
        docker compose -f "$COMPOSE_FILE" ps
    fi
    
    # 检查服务健康状态
    if docker ps --filter "name=gitlab-ce" --filter "status=running" | grep -q gitlab-ce; then
        log_success "GitLab 容器正在运行"
        
        # 检查 HTTP 服务是否可用
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200\|302"; then
            log_success "GitLab Web 服务可用: http://localhost:8080"
        else
            log_warning "GitLab Web 服务暂时不可用，可能还在启动中..."
        fi
    else
        log_error "GitLab 容器未运行"
    fi
}

# 备份数据
backup_gitlab() {
    log_info "备份 GitLab 数据..."
    
    BACKUP_DIR="./gitlab-backup/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # 创建应用备份
    docker exec gitlab-ce gitlab-backup create
    
    # 复制配置文件
    docker cp gitlab-ce:/etc/gitlab "$BACKUP_DIR/config"
    
    # 复制备份文件
    docker cp gitlab-ce:/var/opt/gitlab/backups "$BACKUP_DIR/backups"
    
    log_success "备份完成: $BACKUP_DIR"
}

# 恢复数据
restore_gitlab() {
    if [ -z "$2" ]; then
        log_error "请指定备份目录路径"
        log_info "使用方法: $0 restore /path/to/backup"
        exit 1
    fi
    
    BACKUP_PATH="$2"
    
    if [ ! -d "$BACKUP_PATH" ]; then
        log_error "备份目录不存在: $BACKUP_PATH"
        exit 1
    fi
    
    log_info "从 $BACKUP_PATH 恢复 GitLab 数据..."
    log_warning "此操作将覆盖现有数据，请确认后继续..."
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "操作已取消"
        exit 0
    fi
    
    # 停止服务
    stop_gitlab
    
    # 恢复配置
    if [ -d "$BACKUP_PATH/config" ]; then
        docker cp "$BACKUP_PATH/config" gitlab-ce:/etc/gitlab
    fi
    
    # 恢复备份文件
    if [ -d "$BACKUP_PATH/backups" ]; then
        docker cp "$BACKUP_PATH/backups" gitlab-ce:/var/opt/gitlab/backups
    fi
    
    # 启动服务
    start_gitlab
    
    log_success "数据恢复完成"
}

# 显示帮助信息
show_help() {
    echo "GitLab Docker 私服管理脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 [命令]"
    echo ""
    echo "可用命令:"
    echo "  start     启动 GitLab 私服"
    echo "  stop      停止 GitLab 私服"
    echo "  restart   重启 GitLab 私服"
    echo "  logs      查看 GitLab 日志"
    echo "  status    显示服务状态"
    echo "  backup    备份 GitLab 数据"
    echo "  restore   恢复 GitLab 数据"
    echo "  help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start                    # 启动 GitLab"
    echo "  $0 logs                     # 查看日志"
    echo "  $0 backup                   # 备份数据"
    echo "  $0 restore ./backup/path    # 恢复数据"
}

# 主函数
main() {
    case "${1:-help}" in
        start)
            start_gitlab
            ;;
        stop)
            stop_gitlab
            ;;
        restart)
            restart_gitlab
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        backup)
            backup_gitlab
            ;;
        restore)
            restore_gitlab "$@"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"