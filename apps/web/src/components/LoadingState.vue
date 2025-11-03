<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

interface Props {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  message: '加载中...',
  size: 'md',
})

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12">
    <Loader2 :class="['animate-spin text-muted-foreground mb-4', sizeClasses[size]]" />
    <p v-if="message" class="text-sm text-muted-foreground">{{ message }}</p>
  </div>
</template>
