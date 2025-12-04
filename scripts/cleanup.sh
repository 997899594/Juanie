#!/bin/bash

# 项目清理脚本
# 删除所有不应该存在的文件

set -e

echo "🧹 开始清理项目..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 删除备份文件
echo ""
echo "📦 清理备份文件..."
BACKUP_FILES=$(find . -type f \( -name "*.bak" -o -name "*.backup" -o -name "*.old" -o -name "*.broken" -o -name "*.temp" \) 2>/dev/null | grep -v node_modules | grep -v .git || true)

if [ -z "$BACKUP_FILES" ]; then
  echo -e "${GREEN}✅ 未发现备份文件${NC}"
else
  echo -e "${YELLOW}发现以下备份文件:${NC}"
  echo "$BACKUP_FILES"
  echo "$BACKUP_FILES" | while read -r file; do
    rm -f "$file"
    echo -e "${GREEN}  删除: $file${NC}"
  done
fi

# 2. 删除空文件
echo ""
echo "📄 清理空文件..."
EMPTY_FILES=$(find apps packages -type f -size 0 2>/dev/null | grep -v node_modules | grep -v .git || true)

if [ -z "$EMPTY_FILES" ]; then
  echo -e "${GREEN}✅ 未发现空文件${NC}"
else
  echo -e "${YELLOW}发现以下空文件:${NC}"
  echo "$EMPTY_FILES"
  echo "$EMPTY_FILES" | while read -r file; do
    rm -f "$file"
    echo -e "${GREEN}  删除: $file${NC}"
  done
fi

# 3. 删除 macOS 系统文件
echo ""
echo "🍎 清理 macOS 系统文件..."
find . -name ".DS_Store" -type f -delete 2>/dev/null || true
echo -e "${GREEN}✅ macOS 系统文件已清理${NC}"

# 4. 清理构建产物（可选）
echo ""
read -p "是否清理所有构建产物？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🏗️  清理构建产物..."
  find . -name "dist" -type d -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
  find . -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true
  echo -e "${GREEN}✅ 构建产物已清理${NC}"
fi

# 5. 格式化代码
echo ""
read -p "是否运行代码格式化？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "💅 格式化代码..."
  bun run format 2>/dev/null || npm run format || echo -e "${YELLOW}⚠️  格式化失败，请手动运行 'bun run format'${NC}"
fi

echo ""
echo -e "${GREEN}✅ 清理完成！${NC}"
echo ""
echo "建议运行以下命令检查:"
echo "  git status              # 查看变更"
echo "  bun run type-check      # 类型检查"
echo "  bun run lint            # 代码检查"
