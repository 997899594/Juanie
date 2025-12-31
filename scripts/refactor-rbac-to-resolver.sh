#!/bin/bash

# 批量重构 withAbility 为 checkPermission 的脚本
# 
# 使用方法：
# ./scripts/refactor-rbac-to-resolver.sh

set -e

echo "🔧 开始重构 RBAC 权限检查..."
echo ""

# 定义需要重构的文件
FILES=(
  "apps/api-gateway/src/routers/projects.router.ts"
  "apps/api-gateway/src/routers/deployments.router.ts"
  "apps/api-gateway/src/routers/git-sync.router.ts"
)

# 备份文件
echo "📦 备份原文件..."
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$file.backup"
    echo "  ✓ 备份: $file -> $file.backup"
  fi
done

echo ""
echo "⚠️  注意：此脚本只能处理简单的模式"
echo "   复杂的嵌套 router 需要手动重构"
echo ""
echo "📝 需要手动完成以下步骤："
echo ""
echo "1. 将 import { withAbility } 改为 import { checkPermission }"
echo ""
echo "2. 将以下模式："
echo "   withAbility(this.trpc.protectedProcedure, this.rbacService, {"
echo "     action: 'read',"
echo "     subject: 'Project',"
echo "   })"
echo "     .input(schema)"
echo "     .query(async ({ ctx, input }) => {"
echo "       return await service.method(input)"
echo "     })"
echo ""
echo "3. 改为："
echo "   this.trpc.protectedProcedure"
echo "     .input(schema)"
echo "     .query(async ({ ctx, input }) => {"
echo "       await checkPermission("
echo "         this.rbacService,"
echo "         ctx.user.id,"
echo "         'read',"
echo "         'Project',"
echo "         input.projectId,"
echo "       )"
echo "       return await service.method(input)"
echo "     })"
echo ""
echo "4. 注意提取正确的 organizationId 或 projectId 从 input"
echo ""
echo "✅ 备份完成！现在请手动重构这些文件："
for file in "${FILES[@]}"; do
  echo "   - $file"
done
echo ""
echo "💡 提示：可以使用 Kiro AI 来帮助重构"
echo "   只需要告诉它：'重构 projects.router.ts 中所有的 withAbility'"
