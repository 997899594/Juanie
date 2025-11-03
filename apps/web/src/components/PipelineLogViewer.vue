<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle>运行日志</CardTitle>
        <div class="flex items-center space-x-2">
          <Button variant="outline" size="sm" @click="scrollToBottom">
            <ArrowDown class="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" @click="copyLogs">
            <Copy class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div
        ref="logContainer"
        class="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto"
      >
        <div v-for="(log, index) in logs" :key="index" class="mb-1">
          <span class="text-gray-500">[{{ formatTime(log.timestamp) }}]</span>
          {{ log.message }}
        </div>
        <div v-if="logs.length === 0" class="text-gray-500">等待日志输出...</div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@juanie/ui'
import { ArrowDown, Copy } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  logs: Array<{ timestamp: string; message: string }>
}>()

const toast = useToast()
const logContainer = ref<HTMLElement | null>(null)

watch(
  () => props.logs,
  () => {
    nextTick(() => {
      scrollToBottom()
    })
  },
  { deep: true }
)

const scrollToBottom = () => {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
}

const copyLogs = () => {
  const logsText = props.logs.map((log) => `[${log.timestamp}] ${log.message}`).join('\n')
  navigator.clipboard.writeText(logsText)
  toast.success('日志已复制到剪贴板')
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN')
}
</script>
