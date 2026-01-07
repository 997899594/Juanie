<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Send, StopCircle, Trash2, RotateCw } from 'lucide-vue-next'
import { useAiChat } from '@/composables/useAiChat'

// 使用 AI Chat composable
const {
  messages,
  input,
  isLoading,
  error,
  sendMessage,
  clearMessages,
  regenerate,
  stopGeneration,
  setInput,
} = useAiChat({
  systemPrompt: '你是一个专业的 DevOps 助手，帮助用户管理 Kubernetes 集群和 GitOps 工作流。',
  onFinish: (message) => {
    console.log('AI 回复完成:', message)
  },
})

// 消息容器引用（用于自动滚动）
const messagesContainer = ref<HTMLElement>()

// 自动滚动到底部
watch(messages, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
})

// 发送消息处理
const handleSend = async () => {
  const content = input.value.trim()
  if (!content || isLoading.value) return

  await sendMessage(content)
  setInput('') // 清空输入框
}

// 键盘事件处理
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

// 格式化时间
const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
</script>

<template>
  <div class="flex h-full flex-col bg-background">
    <!-- Header -->
    <div class="border-b px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">AI 助手</h1>
          <p class="text-sm text-muted-foreground">专业的 DevOps 和 Kubernetes 助手</p>
        </div>
        <div class="flex gap-2">
          <UiButton
            v-if="messages.length > 0"
            variant="outline"
            size="sm"
            @click="clearMessages"
          >
            <Trash2 class="mr-2 h-4 w-4" />
            清空对话
          </UiButton>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto px-6 py-4"
    >
      <!-- Empty State -->
      <div
        v-if="messages.length === 0"
        class="flex h-full items-center justify-center"
      >
        <div class="text-center">
          <div class="mb-4 text-6xl">🤖</div>
          <h2 class="mb-2 text-xl font-semibold">开始对话</h2>
          <p class="text-muted-foreground">
            我可以帮助你管理 Kubernetes 集群、部署应用、排查问题等
          </p>
        </div>
      </div>

      <!-- Message List -->
      <div
        v-else
        class="space-y-4"
      >
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="flex gap-3"
          :class="{
            'justify-end': message.role === 'user',
          }"
        >
          <!-- Avatar -->
          <div
            v-if="message.role === 'assistant'"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            🤖
          </div>

          <!-- Message Content -->
          <div
            class="max-w-[70%] rounded-lg px-4 py-3"
            :class="{
              'bg-primary text-primary-foreground': message.role === 'user',
              'bg-muted': message.role === 'assistant',
            }"
          >
            <div class="whitespace-pre-wrap break-words">
              {{ message.content }}
            </div>
            <div
              class="mt-2 text-xs opacity-70"
            >
              {{ formatTime(message.createdAt || new Date()) }}
            </div>
          </div>

          <!-- Avatar -->
          <div
            v-if="message.role === 'user'"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            👤
          </div>
        </div>

        <!-- Loading Indicator -->
        <div
          v-if="isLoading"
          class="flex gap-3"
        >
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            🤖
          </div>
          <div class="rounded-lg bg-muted px-4 py-3">
            <div class="flex gap-1">
              <div class="h-2 w-2 animate-bounce rounded-full bg-foreground/50" />
              <div class="h-2 w-2 animate-bounce rounded-full bg-foreground/50 [animation-delay:0.2s]" />
              <div class="h-2 w-2 animate-bounce rounded-full bg-foreground/50 [animation-delay:0.4s]" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div
      v-if="error"
      class="border-t bg-destructive/10 px-6 py-3"
    >
      <div class="flex items-center justify-between">
        <p class="text-sm text-destructive">
          {{ error.message }}
        </p>
        <UiButton
          variant="outline"
          size="sm"
          @click="regenerate"
        >
          <RotateCw class="mr-2 h-4 w-4" />
          重试
        </UiButton>
      </div>
    </div>

    <!-- Input Area -->
    <div class="border-t px-6 py-4">
      <div class="flex gap-2">
        <UiTextarea
          v-model="input"
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          class="min-h-[60px] resize-none"
          :disabled="isLoading"
          @keydown="handleKeydown"
        />
        <div class="flex flex-col gap-2">
          <UiButton
            v-if="!isLoading"
            size="icon"
            :disabled="!input.trim()"
            @click="handleSend"
          >
            <Send class="h-4 w-4" />
          </UiButton>
          <UiButton
            v-else
            size="icon"
            variant="destructive"
            @click="stopGeneration"
          >
            <StopCircle class="h-4 w-4" />
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>
