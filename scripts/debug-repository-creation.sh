#!/bin/bash

# 调试仓库创建问题的脚本

echo "🔍 调试仓库创建问题"
echo "===================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_step() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
    fi
}

# 1. 检查 GitProviderService 是否正确注入
echo "1️⃣  检查 GitProviderService 模块..."
if grep -q "GitProviderService" packages/services/projects/src/projects.module.ts; then
    check_step "GitProviderService 已在 ProjectsModule 中注入"
else
    echo -e "${RED}✗${NC} GitProviderService 未在 ProjectsModule 中注入"
    echo "   请检查 packages/services/projects/src/projects.module.ts"
fi

# 2. 检查 OAuthAccountsService 是否正确注入
echo ""
echo "2️⃣  检查 OAuthAccountsService 模块..."
if grep -q "OAuthAccountsService" packages/services/projects/src/projects.module.ts; then
    check_step "OAuthAccountsService 已在 ProjectsModule 中注入"
else
    echo -e "${RED}✗${NC} OAuthAccountsService 未在 ProjectsModule 中注入"
    echo "   请检查 packages/services/projects/src/projects.module.ts"
fi

# 3. 检查环境变量
echo ""
echo "3️⃣  检查环境变量..."
if [ -f ".env" ]; then
    if grep -q "GITHUB_CLIENT_ID" .env && grep -q "GITHUB_CLIENT_SECRET" .env; then
        check_step "GitHub OAuth 配置存在"
    else
        echo -e "${YELLOW}⚠${NC}  GitHub OAuth 配置可能缺失"
    fi
    
    if grep -q "GITLAB_CLIENT_ID" .env && grep -q "GITLAB_CLIENT_SECRET" .env; then
        check_step "GitLab OAuth 配置存在"
    else
        echo -e "${YELLOW}⚠${NC}  GitLab OAuth 配置可能缺失"
    fi
else
    echo -e "${RED}✗${NC} .env 文件不存在"
fi

# 4. 检查数据库表
echo ""
echo "4️⃣  检查数据库表结构..."
echo "   请手动运行以下 SQL 查询来检查表是否存在："
echo ""
echo "   SELECT table_name FROM information_schema.tables"
echo "   WHERE table_schema = 'public'"
echo "   AND table_name IN ('projects', 'repositories', 'oauth_accounts');"
echo ""

# 5. 提供调试建议
echo ""
echo "📋 调试建议："
echo "=============="
echo ""
echo "1. 检查后端日志："
echo "   - 查看 API Gateway 日志中是否有错误信息"
echo "   - 查看 ProjectOrchestrator 的日志输出"
echo "   - 查看 GitProviderService 的日志输出"
echo ""
echo "2. 测试 Git Provider API："
echo "   - 使用 curl 测试 GitHub/GitLab API 是否可访问"
echo "   - 验证访问令牌是否有效"
echo ""
echo "3. 检查数据库连接："
echo "   - 确认数据库连接正常"
echo "   - 检查 repositories 表是否存在"
echo "   - 检查 oauth_accounts 表是否存在"
echo ""
echo "4. 前端调试："
echo "   - 打开浏览器开发者工具"
echo "   - 查看 Network 标签中的请求和响应"
echo "   - 查看 Console 中的错误信息"
echo ""
echo "5. 常见问题："
echo "   - 访问令牌权限不足（需要 repo 权限）"
echo "   - 仓库名称已存在"
echo "   - OAuth 账户未连接或令牌过期"
echo "   - 网络连接问题"
echo ""

# 6. 提供测试命令
echo "🧪 测试命令："
echo "============"
echo ""
echo "# 测试 GitHub API（替换 YOUR_TOKEN）："
echo 'curl -H "Authorization: Bearer YOUR_TOKEN" https://api.github.com/user'
echo ""
echo "# 测试创建 GitHub 仓库（替换 YOUR_TOKEN 和 REPO_NAME）："
echo 'curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '"'"'{"name":"REPO_NAME","private":true,"auto_init":true}'"'"' \'
echo '     https://api.github.com/user/repos'
echo ""
echo "# 查看数据库中的 OAuth 账户："
echo 'psql -d your_database -c "SELECT id, user_id, provider, created_at FROM oauth_accounts;"'
echo ""
