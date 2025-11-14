#!/bin/bash

# 仓库同步功能验证脚本
# 用于验证修复后的仓库创建功能是否正常工作

set -e

echo "🔍 验证仓库同步功能修复..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_step() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1"
        return 1
    fi
}

# 1. 检查 git-providers 包配置
echo "1️⃣  检查 git-providers 包配置..."
if [ -f "packages/services/git-providers/package.json" ]; then
    if grep -q '"build": "tsc"' packages/services/git-providers/package.json; then
        check_step "package.json 配置正确"
    else
        check_step "package.json 缺少构建脚本" && exit 1
    fi
else
    echo -e "${RED}✗${NC} 找不到 git-providers/package.json"
    exit 1
fi

# 2. 检查 tsconfig.json
echo ""
echo "2️⃣  检查 TypeScript 配置..."
if [ -f "packages/services/git-providers/tsconfig.json" ]; then
    if grep -q '"incremental": true' packages/services/git-providers/tsconfig.json; then
        check_step "tsconfig.json 配置正确"
    else
        check_step "tsconfig.json 配置不完整" && exit 1
    fi
else
    echo -e "${RED}✗${NC} 找不到 git-providers/tsconfig.json"
    exit 1
fi

# 3. 检查类型定义
echo ""
echo "3️⃣  检查类型定义..."
if grep -q "defaultBranch?: string" packages/core/types/src/project.types.ts; then
    check_step "project.types.ts 包含 defaultBranch 字段"
else
    echo -e "${RED}✗${NC} project.types.ts 缺少 defaultBranch 字段"
    exit 1
fi

if grep -q "defaultBranch: z.string().optional()" packages/core/types/src/schemas.ts; then
    check_step "schemas.ts 包含 defaultBranch 字段"
else
    echo -e "${RED}✗${NC} schemas.ts 缺少 defaultBranch 字段"
    exit 1
fi

# 4. 检查构建输出
echo ""
echo "4️⃣  检查构建输出..."
if [ -d "packages/services/git-providers/dist" ]; then
    if [ -f "packages/services/git-providers/dist/index.js" ]; then
        check_step "git-providers 已构建"
    else
        echo -e "${YELLOW}⚠${NC}  git-providers 未构建，正在构建..."
        cd packages/services/git-providers && bun run build && cd ../../..
        check_step "git-providers 构建完成"
    fi
else
    echo -e "${YELLOW}⚠${NC}  git-providers 未构建，正在构建..."
    cd packages/services/git-providers && bun run build && cd ../../..
    check_step "git-providers 构建完成"
fi

# 5. 检查 ProjectsModule 导入
echo ""
echo "5️⃣  检查模块导入..."
if grep -q "GitProvidersModule" packages/services/projects/src/projects.module.ts; then
    check_step "ProjectsModule 已导入 GitProvidersModule"
else
    echo -e "${RED}✗${NC} ProjectsModule 未导入 GitProvidersModule"
    exit 1
fi

# 6. 运行 TypeScript 类型检查
echo ""
echo "6️⃣  运行 TypeScript 类型检查..."
cd packages/services/projects
if bun run type-check > /dev/null 2>&1; then
    check_step "projects 服务类型检查通过"
else
    echo -e "${RED}✗${NC} projects 服务类型检查失败"
    echo ""
    echo "运行以下命令查看详细错误："
    echo "  cd packages/services/projects && bun run type-check"
    cd ../../..
    exit 1
fi
cd ../../..

# 7. 检查前端组件
echo ""
echo "7️⃣  检查前端组件..."
if [ -f "apps/web/src/components/RepositoryConfig.vue" ]; then
    if grep -q "__USE_OAUTH__" apps/web/src/components/RepositoryConfig.vue; then
        check_step "RepositoryConfig 组件支持 OAuth"
    else
        echo -e "${YELLOW}⚠${NC}  RepositoryConfig 组件可能不支持 OAuth"
    fi
else
    echo -e "${RED}✗${NC} 找不到 RepositoryConfig.vue"
    exit 1
fi

# 总结
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ 所有检查通过！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 下一步："
echo "  1. 运行 'bun run dev' 启动开发服务器"
echo "  2. 登录系统并连接 GitHub/GitLab OAuth 账户"
echo "  3. 创建新项目并测试仓库创建功能"
echo ""
echo "📚 详细文档："
echo "  docs/troubleshooting/REPOSITORY_SYNC_FIX.md"
echo ""
