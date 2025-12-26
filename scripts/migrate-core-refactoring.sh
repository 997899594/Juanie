#!/bin/bash

# Core 包重构迁移脚本
# 用途: 批量更新所有导入路径

set -e

echo "🚀 开始 Core 包重构迁移..."

# 颜色定义
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 步骤 1: 更新 Logger 导入
echo -e "${YELLOW}步骤 1: 更新 Logger 导入...${NC}"
find packages apps -type f -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | while read file; do
  if grep -q "from '@juanie/core/logger'" "$file"; then
    sed -i.bak "s/from '@juanie\/core\/logger'/from 'nestjs-pino'/g" "$file"
    sed -i.bak "s/import { Logger }/import { PinoLogger }/g" "$file"
    sed -i.bak "s/private readonly logger: Logger/private readonly logger: PinoLogger/g" "$file"
    sed -i.bak "s/constructor(private readonly logger: Logger)/constructor(private readonly logger: PinoLogger)/g" "$file"
    rm "$file.bak"
    echo "  ✓ 更新: $file"
  fi
done

# 步骤 2: 更新 Foundation 层错误导入
echo -e "${YELLOW}步骤 2: 更新 Foundation 层错误导入...${NC}"
find packages/services/foundation -type f -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | while read file; do
  if grep -q "from '@juanie/core/errors'" "$file"; then
    # 替换特定的错误类
    sed -i.bak "s/GitConnectionNotFoundError,/GitConnectionNotFoundError,/g" "$file"
    # 更新导入路径
    sed -i.bak "s/from '@juanie\/core\/errors'/from '@juanie\/service-foundation\/errors'/g" "$file"
    rm "$file.bak"
    echo "  ✓ 更新: $file"
  fi
done

# 步骤 3: 更新 Business 层错误导入
echo -e "${YELLOW}步骤 3: 更新 Business 层错误导入...${NC}"
find packages/services/business -type f -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | while read file; do
  if grep -q "from '@juanie/core/errors'" "$file"; then
    # 更新导入路径
    sed -i.bak "s/from '@juanie\/core\/errors'/from '@juanie\/service-business\/errors'/g" "$file"
    rm "$file.bak"
    echo "  ✓ 更新: $file"
  fi
done

# 步骤 4: 更新 Events 导入
echo -e "${YELLOW}步骤 4: 更新 Events 导入...${NC}"
find packages -type f -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | while read file; do
  if grep -q "from '@juanie/core/events'" "$file"; then
    sed -i.bak "s/from '@juanie\/core\/events'/from '@nestjs\/event-emitter'/g" "$file"
    sed -i.bak "s/EventPublisher/EventEmitter2/g" "$file"
    sed -i.bak "s/DomainEvents/EventEmitter2/g" "$file"
    sed -i.bak "s/SystemEvents/EventEmitter2/g" "$file"
    rm "$file.bak"
    echo "  ✓ 更新: $file"
  fi
done

echo -e "${GREEN}✅ 迁移完成！${NC}"
echo ""
echo "⚠️  请注意:"
echo "1. 运行 'bun install' 安装新依赖"
echo "2. 运行 'bun run type-check' 检查类型错误"
echo "3. 手动检查并修复任何编译错误"
echo "4. 运行 'bun test' 确保所有测试通过"
