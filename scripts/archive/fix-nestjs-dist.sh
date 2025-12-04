#!/bin/bash

# 修复 Bun workspace 中 @nestjs/config 缺少 dist 目录的问题

echo "🔧 Fixing @nestjs/config dist directories..."

# 查找所有缺少 dist 的 @nestjs/config
find . -path "*/node_modules/@nestjs/config" -type d | while read config_dir; do
  if [ ! -d "$config_dir/dist" ]; then
    echo "  ❌ Missing dist in: $config_dir"
    
    # 从根 node_modules 复制 dist
    if [ -d "node_modules/@nestjs/config/dist" ]; then
      echo "  ✅ Copying dist from root node_modules"
      cp -r node_modules/@nestjs/config/dist "$config_dir/"
    fi
  else
    echo "  ✅ dist exists in: $config_dir"
  fi
done

echo "✅ Done!"
