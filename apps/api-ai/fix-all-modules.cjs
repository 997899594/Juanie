#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const modulesDir = './src/modules';

// 需要添加 TrpcService 的模块列表（有 Router 的模块）
const modulesWithRouters = [
  'environments/environments.module.ts',
  'audit-logs/audit-logs.module.ts',
  'oauth-flows/oauth-flows.module.ts',
  'cost-tracking/cost-tracking.module.ts',
  'performance-metrics/performance-metrics.module.ts',
  'oauth-accounts/oauth-accounts.module.ts',
  'projects/projects.module.ts',
  'monitoring-configs/monitoring-configs.module.ts',
  'webhook-events/webhook-events.module.ts',
  'pipelines/pipelines.module.ts',
  'organizations/organizations.module.ts',
  'auth-sessions/auth-sessions.module.ts',
  'deployments/deployments.module.ts',
  'events/events.module.ts',
  'incidents/incidents.module.ts',
  'project-memberships/project-memberships.module.ts',
  'workflows/workflows.module.ts',
  'intelligent-alerts/intelligent-alerts.module.ts',
  'auth/auth.module.ts',
  'team-members/team-members.module.ts',
  'role-assignments/role-assignments.module.ts',
  'ai-assistants/ai-assistants.module.ts',
  'ai-recommendations/ai-recommendations.module.ts',
  'roles/roles.module.ts',
  'webhook-endpoints/webhook-endpoints.module.ts',
  'repositories/repositories.module.ts',
  'code-analysis-results/code-analysis-results.module.ts',
  'teams/teams.module.ts',
  'vulnerability-scans/vulnerability-scans.module.ts',
  'security-policies/security-policies.module.ts',
  'identity-providers/identity-providers.module.ts',
  'experiments/experiments.module.ts',
  'pipeline-runs/pipeline-runs.module.ts'
];

function fixModuleFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 检查是否已经导入了 TrpcService
  if (!content.includes("import { TrpcService }")) {
    // 添加 TrpcService 导入
    const importMatch = content.match(/(import { Module } from '@nestjs\/common';\n)/);
    if (importMatch) {
      content = content.replace(
        importMatch[1],
        importMatch[1] + "import { TrpcService } from '../../trpc/trpc.service';\n"
      );
    }
  }
  
  // 检查 providers 数组中是否已经包含 TrpcService
  if (!content.includes('TrpcService') || content.match(/providers:\s*\[[^\]]*\]/)) {
    // 在 providers 数组中添加 TrpcService
    content = content.replace(
      /providers:\s*\[([^\]]*)\]/,
      (match, providers) => {
        const cleanProviders = providers.trim();
        if (cleanProviders && !cleanProviders.includes('TrpcService')) {
          return `providers: [${cleanProviders}, TrpcService]`;
        } else if (!cleanProviders) {
          return `providers: [TrpcService]`;
        }
        return match;
      }
    );
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${filePath}`);
}

// 修复所有文件
modulesWithRouters.forEach(fileName => {
  const filePath = path.join(modulesDir, fileName);
  if (fs.existsSync(filePath)) {
    fixModuleFile(filePath);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('All modules with routers have been fixed!');