#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要清理 TrpcService 提供者的模块目录
const modulesDir = '/Users/findbiao/projects/Juanie/apps/api-ai/src/modules';

// 获取所有模块目录
const moduleDirectories = fs.readdirSync(modulesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

console.log(`找到 ${moduleDirectories.length} 个模块目录`);

let processedCount = 0;

moduleDirectories.forEach(moduleDir => {
  const moduleFilePath = path.join(modulesDir, moduleDir, `${moduleDir}.module.ts`);
  
  if (fs.existsSync(moduleFilePath)) {
    let content = fs.readFileSync(moduleFilePath, 'utf8');
    
    // 检查是否包含 TrpcService
    if (content.includes('TrpcService')) {
      console.log(`处理模块: ${moduleDir}`);
      
      // 移除 TrpcService 的导入
      content = content.replace(/import\s*{\s*([^}]*,\s*)?TrpcService(\s*,\s*[^}]*)?\s*}\s*from\s*['"][^'"]*trpc[^'"]*['"];?\s*\n?/g, (match, before, after) => {
        if (before && after) {
          return `import { ${before.trim()}${after.trim()} } from '${match.match(/from\s*['"]([^'"]*)['"]/)[1]}';\n`;
        } else if (before) {
          return `import { ${before.trim()} } from '${match.match(/from\s*['"]([^'"]*)['"]/)[1]}';\n`;
        } else if (after) {
          return `import { ${after.trim()} } from '${match.match(/from\s*['"]([^'"]*)['"]/)[1]}';\n`;
        } else {
          return ''; // 完全移除导入
        }
      });
      
      // 从 providers 数组中移除 TrpcService
      content = content.replace(/providers:\s*\[([^\]]*)\]/g, (match, providersContent) => {
        const cleanedProviders = providersContent
          .split(',')
          .map(p => p.trim())
          .filter(p => p && !p.includes('TrpcService'))
          .join(', ');
        
        return `providers: [${cleanedProviders}]`;
      });
      
      // 清理多余的空行和逗号
      content = content.replace(/,\s*,/g, ',');
      content = content.replace(/\[\s*,/g, '[');
      content = content.replace(/,\s*\]/g, ']');
      content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      fs.writeFileSync(moduleFilePath, content);
      processedCount++;
      console.log(`✅ 已清理 ${moduleDir}.module.ts 中的 TrpcService 提供者`);
    }
  }
});

console.log(`\n🎉 处理完成！共清理了 ${processedCount} 个模块文件`);