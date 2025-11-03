<template>
  <Badge :variant="getVariant(status)">
    <component :is="getIcon(status)" class="mr-1 h-3 w-3" />
    {{ getText(status) }}
  </Badge>
</template>

<script setup lang="ts">
import { Badge } from '@juanie/ui'
import { CheckCircle, XCircle, Clock, Loader2, Pause } from 'lucide-vue-next'

defineProps<{
  status: string
}>()

const getVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    success: 'default',
    running: 'default',
    failed: 'destructive',
    pending: 'secondary',
    canceled: 'outline',
  }
  return variantMap[status] || 'outline'
}

const getText = (status: string) => {
  const textMap: Record<string, string> = {
    success: '成功',
    running: '运行中',
    failed: '失败',
    pending: '等待中',
    canceled: '已取消',
  }
  return textMap[status] || status
}

const getIcon = (status: string) => {
  const iconMap: Record<string, any> = {
    success: CheckCircle,
    running: Loader2,
    failed: XCircle,
    pending: Clock,
    canceled: Pause,
  }
  return iconMap[status] || Clock
}
</script>
