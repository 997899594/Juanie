<script setup lang="ts">
import { Button, Alert, AlertTitle, AlertDescription } from '@juanie/ui'
import { AlertCircle, RefreshCw } from 'lucide-vue-next'

interface Props {
  title?: string
  message?: string
  showRetry?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '出错了',
  message: '加载数据时发生错误，请稍后重试',
  showRetry: true,
})

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4">
    <Alert variant="destructive" class="max-w-md">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>{{ title }}</AlertTitle>
      <AlertDescription>
        {{ message }}
      </AlertDescription>
    </Alert>
    <Button
      v-if="showRetry"
      variant="outline"
      class="mt-6"
      @click="emit('retry')"
    >
      <RefreshCw class="mr-2 h-4 w-4" />
      重试
    </Button>
  </div>
</template>
