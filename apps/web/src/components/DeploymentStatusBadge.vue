<template>
  <Badge :variant="getVariant(status)">
    <component :is="getIcon(status)" class="mr-1 h-3 w-3" />
    {{ getText(status) }}
  </Badge>
</template>

<script setup lang="ts">
import { Badge } from '@juanie/ui'
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  status: string
}>()

const getVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    success: 'default',
    deploying: 'default',
    failed: 'destructive',
    pending: 'secondary',
    'pending-approval': 'secondary',
    approved: 'default',
    rejected: 'destructive',
  }
  return variantMap[status] || 'outline'
}

const getText = (status: string) => {
  const textMap: Record<string, string> = {
    success: '成功',
    deploying: '部署中',
    failed: '失败',
    pending: '等待中',
    'pending-approval': '待审批',
    approved: '已批准',
    rejected: '已拒绝',
  }
  return textMap[status] || status
}

const getIcon = (status: string) => {
  const iconMap: Record<string, any> = {
    success: CheckCircle,
    deploying: Loader2,
    failed: XCircle,
    pending: Clock,
    'pending-approval': AlertCircle,
    approved: CheckCircle,
    rejected: XCircle,
  }
  return iconMap[status] || Clock
}
</script>
