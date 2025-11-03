#!/bin/bash

# 检查所有使用 ConfigService 但没有导入 ConfigModule 的模块
# 用于预防 NestJS 依赖注入错误

echo "🔍 检查 NestJS 模块的 ConfigService 依赖..."

# 查找所有使用 ConfigService 的 service 文件
services_with_config=$(grep -r "ConfigService" packages/services --include="*.service.ts" -l)

issues_found=0

for service_file in $services_with_config; do
  # 获取对应的 module 文件
  module_file="${service_file/.service.ts/.module.ts}"
  
  if [ -f "$module_file" ]; then
    # 检查 module 文件是否导入了 ConfigModule
    if ! grep -q "ConfigModule" "$module_file"; then
      echo "❌ $module_file 缺少 ConfigModule 导入"
      echo "   对应的 service: $service_file 使用了 ConfigService"
      issues_found=$((issues_found + 1))
    fi
  fi
done

if [ $issues_found -eq 0 ]; then
  echo "✅ 所有模块的 ConfigService 依赖都正确配置"
  exit 0
else
  echo ""
  echo "⚠️  发现 $issues_found 个模块需要修复"
  echo "💡 修复方法: 在模块文件中添加 ConfigModule 到 imports 数组"
  exit 1
fi
