#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const modulesDir = './src/modules';

// 需要移除 TrpcModule 导入的文件列表
const filesToFix = [
  'code-analysis-results/code-analysis-results.module.ts',
  'project-memberships/project-memberships.module.ts',
  'identity-providers/identity-providers.module.ts',
  'auth-sessions/auth-sessions.module.ts',
  'vulnerability-scans/vulnerability-scans.module.ts',
  'role-assignments/role-assignments.module.ts',
  'roles/roles.module.ts',
  'oauth-accounts/oauth-accounts.module.ts',
  'oauth-flows/oauth-flows.module.ts',
  'security-policies/security-policies.module.ts',
  'environments/environments.module.ts',
  'repositories/repositories.module.ts',
  'auth/auth.module.ts',
  'team-members/team-members.module.ts'
];

function fixModuleFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 移除 TrpcModule 导入行
  content = content.replace(/import.*TrpcModule.*from.*;\n/g, '');
  
  // 移除 imports 数组中的 TrpcModule
  content = content.replace(/imports:\s*\[TrpcModule\],?\s*\n/g, '');
  content = content.replace(/imports:\s*\[\s*TrpcModule\s*\],?\s*\n/g, '');
  
  // 处理只有 TrpcModule 的情况
  content = content.replace(/imports:\s*\[TrpcModule\]/g, '');
  
  // 清理空的 imports 数组
  content = content.replace(/imports:\s*\[\s*\],?\s*\n/g, '');
  
  // 清理多余的逗号
  content = content.replace(/,\s*\]/g, ']');
  content = content.replace(/,\s*}/g, '}');
  
  // 清理多余的空行
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${filePath}`);
}

// 修复所有文件
filesToFix.forEach(fileName => {
  const filePath = path.join(modulesDir, fileName);
  if (fs.existsSync(filePath)) {
    fixModuleFile(filePath);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('All circular dependencies have been fixed!');