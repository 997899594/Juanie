#!/bin/bash

# 环境变量检查脚本
# 验证所有必需的环境变量是否已设置

set -e

echo "🔍 检查环境配置..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
  echo -e "${RED}❌ .env 文件不存在${NC}"
  echo -e "${YELLOW}💡 运行: cp .env.example .env${NC}"
  exit 1
fi

echo -e "${GREEN}✅ .env 文件存在${NC}"
echo ""

# 加载 .env 文件
export $(cat .env | grep -v '^#' | xargs)

# 必需变量列表
REQUIRED_VARS=(
  "NODE_ENV"
  "PORT"
  "REDIS_URL"
  "JWT_SECRET"
  "POSTGRES_USER"
  "POSTGRES_PASSWORD"
  "POSTGRES_DB"
)

# 可选但推荐的变量
RECOMMENDED_VARS=(
  "GITHUB_CLIENT_ID"
  "GITHUB_CLIENT_SECRET"
  "OLLAMA_HOST"
  "CORS_ORIGIN"
)

missing_required=0
missing_recommended=0

# 检查必需变量
echo "📋 检查必需变量:"
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${RED}  ❌ $var 未设置${NC}"
    missing_required=$((missing_required + 1))
  else
    echo -e "${GREEN}  ✅ $var${NC}"
  fi
done

echo ""

# 检查推荐变量
echo "💡 检查推荐变量:"
for var in "${RECOMMENDED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${YELLOW}  ⚠️  $var 未设置 (可选)${NC}"
    missing_recommended=$((missing_recommended + 1))
  else
    echo -e "${GREEN}  ✅ $var${NC}"
  fi
done

echo ""

# 验证 DATABASE_URL 格式 (如果设置了)
if [ -n "$DATABASE_URL" ] && [[ ! $DATABASE_URL =~ ^postgresql:// ]]; then
  echo -e "${YELLOW}⚠️  DATABASE_URL 格式错误,应该以 postgresql:// 开头${NC}"
fi

# 验证 REDIS_URL 格式
if [[ ! $REDIS_URL =~ ^redis:// ]]; then
  echo -e "${RED}❌ REDIS_URL 格式错误,应该以 redis:// 开头${NC}"
  missing_required=$((missing_required + 1))
fi

# 验证 JWT_SECRET 长度
if [ ${#JWT_SECRET} -lt 32 ]; then
  echo -e "${RED}❌ JWT_SECRET 长度不足 32 个字符${NC}"
  missing_required=$((missing_required + 1))
fi

# 如果设置了 DATABASE_URL,验证与 POSTGRES_* 一致性
if [ -n "$DATABASE_URL" ]; then
  if [[ $DATABASE_URL != *"$POSTGRES_USER"* ]] || \
     [[ $DATABASE_URL != *"$POSTGRES_PASSWORD"* ]] || \
     [[ $DATABASE_URL != *"$POSTGRES_DB"* ]]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL 与 POSTGRES_* 变量可能不一致${NC}"
    echo -e "${YELLOW}   建议删除 DATABASE_URL,让系统自动构建${NC}"
  fi
else
  echo -e "${GREEN}✅ 将自动从 POSTGRES_* 变量构建数据库连接${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 总结
if [ $missing_required -eq 0 ]; then
  echo -e "${GREEN}✅ 所有必需变量已正确配置${NC}"
  if [ $missing_recommended -gt 0 ]; then
    echo -e "${YELLOW}⚠️  有 $missing_recommended 个推荐变量未设置${NC}"
  fi
  echo ""
  echo "🚀 可以启动应用了!"
  exit 0
else
  echo -e "${RED}❌ 有 $missing_required 个必需变量缺失或错误${NC}"
  echo ""
  echo "📖 请参考文档: docs/CONFIGURATION.md"
  exit 1
fi
