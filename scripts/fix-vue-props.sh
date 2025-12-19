#!/bin/bash

# 修复 Vue 组件中的 defineProps 和 defineEmits

echo "Fixing Vue props and emits declarations..."

# 获取所有需要修复的 .vue 文件
files=$(find apps/web/src -name "*.vue" -type f)

for file in $files; do
  # 检查文件是否包含需要修复的模式
  if grep -q "^withDefaults(defineProps<" "$file" || \
     grep -q "^defineProps<" "$file" || \
     grep -q "^defineEmits<" "$file"; then
    
    echo "Processing: $file"
    
    # 创建临时文件
    tmp_file="${file}.tmp"
    
    # 使用 sed 进行替换
    sed \
      -e 's/^withDefaults(defineProps</const props = withDefaults(defineProps</g' \
      -e 's/^defineProps</const props = defineProps</g' \
      -e 's/^defineEmits</const emit = defineEmits</g' \
      "$file" > "$tmp_file"
    
    # 替换原文件
    mv "$tmp_file" "$file"
  fi
done

echo "✅ Fixed Vue props and emits declarations"
