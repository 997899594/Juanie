#!/bin/bash

# 修复未使用的 props 变量
find apps/web/src -name "*.vue" -type f -exec sed -i '' 's/^const props = defineProps/defineProps/g' {} \;
find apps/web/src -name "*.vue" -type f -exec sed -i '' 's/^const props = withDefaults(defineProps/withDefaults(defineProps/g' {} \;

# 修复未使用的 emit 变量  
find apps/web/src -name "*.vue" -type f -exec sed -i '' 's/^const emit = defineEmits/defineEmits/g' {} \;

echo "Fixed unused props and emit variables"
