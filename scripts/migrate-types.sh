#!/bin/bash

# 类型迁移自动化脚本
# 用于将路由中的内联 Zod schemas 替换为共享 schemas

set -e

echo "🚀 开始类型迁移..."

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Projects Router
echo -e "${BLUE}迁移 Projects Router...${NC}"
FILE="apps/api-gateway/src/routers/projects.router.ts"

# 简单的 projectId 替换
sed -i '' 's/\.input(z\.object({ projectId: z\.string() }))/\.input(projectIdSchema)/g' "$FILE"
sed -i '' 's/\.input(z\.object({ projectId: z\.string()\.uuid() }))/\.input(projectIdSchema)/g' "$FILE"

echo -e "${GREEN}✓ Projects Router 部分完成${NC}"

# Teams Router  
echo -e "${BLUE}迁移 Teams Router...${NC}"
FILE="apps/api-gateway/src/routers/teams.router.ts"

if [ -f "$FILE" ]; then
  # 添加导入
  if ! grep -q "from '@juanie/core-types'" "$FILE"; then
    sed -i '' "s/import { z } from 'zod'/import { z } from 'zod'\nimport { createTeamSchema, teamIdSchema, updateTeamSchema, addTeamMemberSchema, updateTeamMemberRoleSchema, removeTeamMemberSchema } from '@juanie\/core-types'/g" "$FILE"
  fi
  
  # 替换简单的 teamId
  sed -i '' 's/\.input(z\.object({ teamId: z\.string() }))/\.input(teamIdSchema)/g' "$FILE"
  
  echo -e "${GREEN}✓ Teams Router 部分完成${NC}"
fi

# Repositories Router
echo -e "${BLUE}迁移 Repositories Router...${NC}"
FILE="apps/api-gateway/src/routers/repositories.router.ts"

if [ -f "$FILE" ]; then
  # 添加导入
  if ! grep -q "from '@juanie/core-types'" "$FILE"; then
    sed -i '' "s/import { z } from 'zod'/import { z } from 'zod'\nimport { connectRepositorySchema, repositoryIdSchema } from '@juanie\/core-types'/g" "$FILE"
  fi
  
  # 替换简单的 repositoryId
  sed -i '' 's/\.input(z\.object({ repositoryId: z\.string() }))/\.input(repositoryIdSchema)/g' "$FILE"
  
  echo -e "${GREEN}✓ Repositories Router 部分完成${NC}"
fi

# Environments Router
echo -e "${BLUE}迁移 Environments Router...${NC}"
FILE="apps/api-gateway/src/routers/environments.router.ts"

if [ -f "$FILE" ]; then
  # 添加导入
  if ! grep -q "from '@juanie/core-types'" "$FILE"; then
    sed -i '' "s/import { z } from 'zod'/import { z } from 'zod'\nimport { createEnvironmentSchema, environmentIdSchema, updateEnvironmentSchema, grantEnvironmentPermissionSchema, revokeEnvironmentPermissionSchema } from '@juanie\/core-types'/g" "$FILE"
  fi
  
  # 替换简单的 environmentId
  sed -i '' 's/\.input(z\.object({ environmentId: z\.string() }))/\.input(environmentIdSchema)/g' "$FILE"
  
  echo -e "${GREEN}✓ Environments Router 部分完成${NC}"
fi

# Pipelines Router
echo -e "${BLUE}迁移 Pipelines Router...${NC}"
FILE="apps/api-gateway/src/routers/pipelines.router.ts"

if [ -f "$FILE" ]; then
  # 添加导入
  if ! grep -q "from '@juanie/core-types'" "$FILE"; then
    sed -i '' "s/import { z } from 'zod'/import { z } from 'zod'\nimport { createPipelineSchema, pipelineIdSchema, updatePipelineSchema, triggerPipelineSchema, pipelineRunIdSchema } from '@juanie\/core-types'/g" "$FILE"
  fi
  
  # 替换简单的 pipelineId 和 runId
  sed -i '' 's/\.input(z\.object({ pipelineId: z\.string() }))/\.input(pipelineIdSchema)/g' "$FILE"
  sed -i '' 's/\.input(z\.object({ runId: z\.string() }))/\.input(pipelineRunIdSchema)/g' "$FILE"
  
  echo -e "${GREEN}✓ Pipelines Router 部分完成${NC}"
fi

# Deployments Router
echo -e "${BLUE}迁移 Deployments Router...${NC}"
FILE="apps/api-gateway/src/routers/deployments.router.ts"

if [ -f "$FILE" ]; then
  # 添加导入
  if ! grep -q "from '@juanie/core-types'" "$FILE"; then
    sed -i '' "s/import { z } from 'zod'/import { z } from 'zod'\nimport { createDeploymentSchema, deploymentIdSchema, approveDeploymentSchema, rejectDeploymentSchema, rollbackDeploymentSchema } from '@juanie\/core-types'/g" "$FILE"
  fi
  
  # 替换简单的 deploymentId
  sed -i '' 's/\.input(z\.object({ deploymentId: z\.string() }))/\.input(deploymentIdSchema)/g' "$FILE"
  
  echo -e "${GREEN}✓ Deployments Router 部分完成${NC}"
fi

# Cost Tracking Router
echo -e "${BLUE}迁移 Cost Tracking Router...${NC}"
FILE="apps/api-gateway/src/routers/cost-tracking.router.ts"

if [ -f "$FILE" ]; then
  # 添加导入
  if ! grep -q "from '@juanie/core-types'" "$FILE"; then
    sed -i '' "s/import { z } from 'zod'/import { z } from 'zod'\nimport { recordCostSchema, listCostsSchema, getCostSummarySchema } from '@juanie\/core-types'/g" "$FILE"
  fi
  
  echo -e "${GREEN}✓ Cost Tracking Router 部分完成${NC}"
fi

# Security Policies Router
echo -e "${BLUE}迁移 Security Policies Router...${NC}"
FILE="apps/api-gateway/src/routers/security-policies.router.ts"

if [ -f "$FILE" ]; then
  # 添加导入
  if ! grep -q "from '@juanie/core-types'" "$FILE"; then
    sed -i '' "s/import { z } from 'zod'/import { z } from 'zod'\nimport { createSecurityPolicySchema, securityPolicyIdSchema, updateSecurityPolicySchema } from '@juanie\/core-types'/g" "$FILE"
  fi
  
  # 替换简单的 policyId
  sed -i '' 's/\.input(z\.object({ policyId: z\.string() }))/\.input(securityPolicyIdSchema)/g' "$FILE"
  
  echo -e "${GREEN}✓ Security Policies Router 部分完成${NC}"
fi

# Notifications Router
echo -e "${BLUE}迁移 Notifications Router...${NC}"
FILE="apps/api-gateway/src/routers/notifications.router.ts"

if [ -f "$FILE" ]; then
  # 添加导入
  if ! grep -q "from '@juanie/core-types'" "$FILE"; then
    sed -i '' "s/import { z } from 'zod'/import { z } from 'zod'\nimport { createNotificationSchema, notificationIdSchema, markNotificationAsReadSchema } from '@juanie\/core-types'/g" "$FILE"
  fi
  
  # 替换简单的 notificationId
  sed -i '' 's/\.input(z\.object({ notificationId: z\.string() }))/\.input(notificationIdSchema)/g' "$FILE"
  
  echo -e "${GREEN}✓ Notifications Router 部分完成${NC}"
fi

# AI Assistants Router
echo -e "${BLUE}迁移 AI Assistants Router...${NC}"
FILE="apps/api-gateway/src/routers/ai-assistants.router.ts"

if [ -f "$FILE" ]; then
  # 添加导入
  if ! grep -q "from '@juanie/core-types'" "$FILE"; then
    sed -i '' "s/import { z } from 'zod'/import { z } from 'zod'\nimport { createAIAssistantSchema, assistantIdSchema, updateAIAssistantSchema, chatWithAssistantSchema, rateAssistantResponseSchema } from '@juanie\/core-types'/g" "$FILE"
  fi
  
  # 替换简单的 assistantId
  sed -i '' 's/\.input(z\.object({ assistantId: z\.string() }))/\.input(assistantIdSchema)/g' "$FILE"
  
  echo -e "${GREEN}✓ AI Assistants Router 部分完成${NC}"
fi

echo ""
echo -e "${GREEN}✅ 自动迁移完成！${NC}"
echo ""
echo "📝 注意事项："
echo "  1. 这个脚本只完成了简单的 ID schema 替换"
echo "  2. 复杂的 create/update schemas 需要手动替换"
echo "  3. 运行 'bun run type-check' 验证类型"
echo "  4. 查看每个文件确认替换正确"
echo ""
echo "🔍 下一步："
echo "  1. 手动替换复杂的 schemas（create, update 等）"
echo "  2. 移除未使用的 'z' 导入"
echo "  3. 运行类型检查和测试"
