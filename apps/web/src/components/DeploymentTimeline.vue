<template>
  <div class="space-y-4">
    <h3 class="text-lg font-semibold">部署时间线</h3>
    <div class="relative space-y-6">
      <!-- Timeline line -->
      <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <!-- Timeline items -->
      <div
        v-for="(event, index) in timelineEvents"
        :key="index"
        class="relative flex items-start space-x-4"
      >
        <!-- Timeline dot -->
        <div
          class="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background"
          :class="getEventColor(event.type)"
        >
          <component :is="getEventIcon(event.type)" class="h-4 w-4" />
        </div>

        <!-- Event content -->
        <div class="flex-1 space-y-1 pb-6">
          <div class="flex items-center justify-between">
            <p class="font-medium">{{ event.title }}</p>
            <span class="text-sm text-muted-foreground">
              {{ formatTime(event.timestamp) }}
            </span>
          </div>
          <p v-if="event.description" class="text-sm text-muted-foreground">
            {{ event.description }}
          </p>
          <p v-if="event.user" class="text-sm text-muted-foreground">
            操作人: {{ event.user }}
          </p>
          <p v-if="event.comment" class="text-sm italic text-muted-foreground">
            "{{ event.comment }}"
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircle,
  XCircle,
  Clock,
  Rocket,
  GitCommit,
  AlertCircle,
  RotateCcw,
} from 'lucide-vue-next'

interface TimelineEvent {
  type: 'created' | 'approved' | 'rejected' | 'deployed' | 'failed' | 'rolled_back'
  title: string
  description?: string
  user?: string
  comment?: string
  timestamp: string
}

const props = defineProps<{
  deployment: any
  approvals?: any[]
}>()

const timelineEvents = computed<TimelineEvent[]>(() => {
  const events: TimelineEvent[] = []

  // Created event
  events.push({
    type: 'created',
    title: '部署创建',
    description: `版本: ${props.deployment.version}`,
    user: props.deployment.deployedBy,
    timestamp: props.deployment.createdAt,
  })

  // Approval events
  if (props.approvals && props.approvals.length > 0) {
    props.approvals.forEach((approval) => {
      if (approval.status === 'approved') {
        events.push({
          type: 'approved',
          title: '审批通过',
          user: approval.approverId,
          comment: approval.comments,
          timestamp: approval.decidedAt || approval.createdAt,
        })
      } else if (approval.status === 'rejected') {
        events.push({
          type: 'rejected',
          title: '审批拒绝',
          user: approval.approverId,
          comment: approval.comments,
          timestamp: approval.decidedAt || approval.createdAt,
        })
      }
    })
  }

  // Deployment status events
  if (props.deployment.status === 'success') {
    events.push({
      type: 'deployed',
      title: '部署成功',
      description: '应用已成功部署到环境',
      timestamp: props.deployment.finishedAt || props.deployment.updatedAt,
    })
  } else if (props.deployment.status === 'failed') {
    events.push({
      type: 'failed',
      title: '部署失败',
      description: '部署过程中发生错误',
      timestamp: props.deployment.finishedAt || props.deployment.updatedAt,
    })
  } else if (props.deployment.status === 'rolled_back') {
    events.push({
      type: 'rolled_back',
      title: '已回滚',
      description: '部署已回滚到上一个版本',
      timestamp: props.deployment.finishedAt || props.deployment.updatedAt,
    })
  }

  // Sort by timestamp
  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
})

const getEventIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    created: GitCommit,
    approved: CheckCircle,
    rejected: XCircle,
    deployed: Rocket,
    failed: AlertCircle,
    rolled_back: RotateCcw,
  }
  return iconMap[type] || Clock
}

const getEventColor = (type: string) => {
  const colorMap: Record<string, string> = {
    created: 'border-blue-500 text-blue-500',
    approved: 'border-green-500 text-green-500',
    rejected: 'border-red-500 text-red-500',
    deployed: 'border-green-500 text-green-500',
    failed: 'border-red-500 text-red-500',
    rolled_back: 'border-yellow-500 text-yellow-500',
  }
  return colorMap[type] || 'border-gray-500 text-gray-500'
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
