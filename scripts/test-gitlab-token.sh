#!/bin/bash

# 测试 GitLab 访问令牌的脚本

echo "🔍 测试 GitLab 访问令牌"
echo "======================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否提供了令牌
if [ -z "$1" ]; then
    echo -e "${RED}错误：${NC}请提供 GitLab 访问令牌"
    echo ""
    echo "用法："
    echo "  ./scripts/test-gitlab-token.sh YOUR_GITLAB_TOKEN"
    echo ""
    echo "如何获取 GitLab 访问令牌："
    echo "  1. 访问 https://gitlab.com/-/profile/personal_access_tokens"
    echo "  2. 点击 'Add new token'"
    echo "  3. 设置名称（如：juanie-platform）"
    echo "  4. 选择过期时间"
    echo "  5. 勾选以下权限："
    echo "     - api (完整的 API 访问权限)"
    echo "     - read_api"
    echo "     - read_repository"
    echo "     - write_repository"
    echo "  6. 点击 'Create personal access token'"
    echo "  7. 复制生成的令牌"
    echo ""
    exit 1
fi

TOKEN="$1"
GITLAB_URL="${2:-https://gitlab.com}"

echo -e "${BLUE}GitLab URL:${NC} $GITLAB_URL"
echo -e "${BLUE}令牌前缀:${NC} ${TOKEN:0:8}..."
echo ""

# 测试 1: 获取用户信息
echo "1️⃣  测试用户信息..."
USER_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
    "$GITLAB_URL/api/v4/user")

HTTP_CODE=$(echo "$USER_RESPONSE" | tail -n1)
USER_DATA=$(echo "$USER_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    USERNAME=$(echo "$USER_DATA" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
    USER_ID=$(echo "$USER_DATA" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo -e "${GREEN}✓${NC} 令牌有效"
    echo -e "  用户名: ${GREEN}$USERNAME${NC}"
    echo -e "  用户 ID: ${GREEN}$USER_ID${NC}"
else
    echo -e "${RED}✗${NC} 令牌无效或已过期"
    echo -e "  HTTP 状态码: ${RED}$HTTP_CODE${NC}"
    echo -e "  响应: $USER_DATA"
    exit 1
fi

echo ""

# 测试 2: 列出项目（测试 API 权限）
echo "2️⃣  测试 API 权限..."
PROJECTS_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
    "$GITLAB_URL/api/v4/projects?owned=true&per_page=5")

HTTP_CODE=$(echo "$PROJECTS_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} API 权限正常"
else
    echo -e "${RED}✗${NC} API 权限不足"
    echo -e "  HTTP 状态码: ${RED}$HTTP_CODE${NC}"
fi

echo ""

# 测试 3: 尝试创建测试仓库
echo "3️⃣  测试创建仓库权限..."
TEST_REPO_NAME="test-repo-$(date +%s)"

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"$TEST_REPO_NAME\",
        \"description\": \"Test repository for token validation\",
        \"visibility\": \"private\",
        \"initialize_with_readme\": true
    }" \
    "$GITLAB_URL/api/v4/projects")

HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
CREATE_DATA=$(echo "$CREATE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
    PROJECT_ID=$(echo "$CREATE_DATA" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    PROJECT_PATH=$(echo "$CREATE_DATA" | grep -o '"path_with_namespace":"[^"]*"' | cut -d'"' -f4)
    
    echo -e "${GREEN}✓${NC} 创建仓库成功"
    echo -e "  项目 ID: ${GREEN}$PROJECT_ID${NC}"
    echo -e "  项目路径: ${GREEN}$PROJECT_PATH${NC}"
    echo ""
    
    # 清理测试仓库
    echo "4️⃣  清理测试仓库..."
    DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE \
        -H "Authorization: Bearer $TOKEN" \
        "$GITLAB_URL/api/v4/projects/$PROJECT_ID")
    
    DELETE_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)
    
    if [ "$DELETE_CODE" = "202" ] || [ "$DELETE_CODE" = "204" ]; then
        echo -e "${GREEN}✓${NC} 测试仓库已删除"
    else
        echo -e "${YELLOW}⚠${NC}  无法删除测试仓库，请手动删除: $PROJECT_PATH"
    fi
else
    echo -e "${RED}✗${NC} 创建仓库失败"
    echo -e "  HTTP 状态码: ${RED}$HTTP_CODE${NC}"
    echo -e "  错误详情:"
    echo "$CREATE_DATA" | python3 -m json.tool 2>/dev/null || echo "$CREATE_DATA"
    
    # 分析错误
    if [ "$HTTP_CODE" = "401" ]; then
        echo ""
        echo -e "${YELLOW}建议：${NC}令牌无效或已过期，请重新生成"
    elif [ "$HTTP_CODE" = "403" ]; then
        echo ""
        echo -e "${YELLOW}建议：${NC}令牌权限不足，请确保勾选了 'api' 权限"
    elif [ "$HTTP_CODE" = "422" ]; then
        echo ""
        echo -e "${YELLOW}建议：${NC}可能是仓库名称冲突或其他验证错误"
    fi
fi

echo ""
echo "======================================"
echo ""

# 总结
if [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✅ 令牌测试通过！${NC}"
    echo ""
    echo "你的 GitLab 令牌可以正常使用。"
    echo "如果在应用中仍然遇到问题，请检查："
    echo "  1. 令牌是否正确复制到应用中"
    echo "  2. 是否使用了正确的 GitLab URL"
    echo "  3. 网络连接是否正常"
else
    echo -e "${RED}❌ 令牌测试失败${NC}"
    echo ""
    echo "请按照以下步骤重新生成令牌："
    echo "  1. 访问 $GITLAB_URL/-/profile/personal_access_tokens"
    echo "  2. 创建新令牌，确保勾选 'api' 权限"
    echo "  3. 复制新令牌并在应用中使用"
fi

echo ""
