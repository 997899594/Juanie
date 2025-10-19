#!/bin/bash

# 数据库设置脚本
echo "🗄️  Setting up database..."

# 生成迁移文件
echo "📝 Generating migration files..."
bun run db:generate

# 运行迁移
echo "🔄 Running migrations..."
bun run db:migrate

# 可选：运行种子数据
if [ "$1" = "--seed" ]; then
  echo "🌱 Running seed data..."
  bun run db:seed
fi

echo "✅ Database setup complete!"