#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const schemasDir = './src/database/schemas';

// 需要修复的文件列表
const filesToFix = [
  'team-members.schema.ts',
  'identity-providers.schema.ts', 
  'oauth-flows.schema.ts',
  'teams.schema.ts',
  'resource-usage.schema.ts',
  'events.schema.ts',
  'incidents.schema.ts',
  'auth-sessions.schema.ts',
  'audit-logs.schema.ts',
  'webhook-events.schema.ts',
  'project-memberships.schema.ts',
  'oauth-accounts.schema.ts',
  'webhook-endpoints.schema.ts',
  'roles.schema.ts',
  'role-assignments.schema.ts'
];

function fixSchemaFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 查找索引对象定义的模式
  const indexObjectRegex = /export const \w+Indexes = \{[\s\S]*?\};/g;
  
  // 移除索引对象定义
  content = content.replace(indexObjectRegex, '');
  
  // 清理多余的空行
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${filePath}`);
}

// 修复所有文件
filesToFix.forEach(fileName => {
  const filePath = path.join(schemasDir, fileName);
  if (fs.existsSync(filePath)) {
    fixSchemaFile(filePath);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('All schema files have been fixed!');