#!/bin/bash

# 批量更新导入路径
# 将 @/database/schemas 替换为 @juanie/core-database/schemas

files=(
  "apps/api/src/modules/notifications/notifications.service.ts"
  "apps/api/src/modules/deployments/deployments.service.ts"
  "apps/api/src/modules/teams/teams.service.ts"
  "apps/api/src/modules/users/users.service.ts"
  "apps/api/src/modules/repositories/repositories.service.ts"
  "apps/api/src/modules/security-policies/security-policies.service.ts"
  "apps/api/src/modules/cost-tracking/cost-tracking.service.ts"
  "apps/api/src/modules/projects/projects.service.ts"
  "apps/api/src/modules/ai-assistants/ai-assistants.service.ts"
  "apps/api/src/modules/audit-logs/audit-logs.service.ts"
  "apps/api/src/modules/environments/environments.service.ts"
  "apps/api/src/modules/organizations/organizations.service.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating $file"
    sed -i '' "s|from '@/database/schemas'|from '@juanie/core-database/schemas'|g" "$file"
  fi
done

echo "Done!"
