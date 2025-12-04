<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAppStore } from '@/stores/app'
import { useAIAssistants, type AIAssistant, type ChatMessage } from '@/composables/useAIAssistants'
import PageContainer from '@/components/PageContainer.vue'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@juanie/ui'
import {
  Bot,
  Send,
  Star,
  Loader2,
  Sparkles,
  User,
  Plus,
  Settings,
} from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'

const appStore = useAppStore()

const {
  assistants,
  currentAssistant,
  messages,
  loading,
  chatting,
  hasAssistants,
  hasMessages,
  fetchAssistants,
  chat,
  rate,
  setCurrentAssistant,
} = useAIAssistants()

// 聊天输入
const messageInput = ref('')
const chatContainer = ref<HTMLDivElement>()

// 评分状态
const showRating = ref(false)
const selectedRating = ref(0)

// 创建助手对话框
const showCreateDialog = ref(false)
const createForm = ref<{
  name: string
  type: 'code_review' | 'devops_engineer' | 'cost_optimizer' | 'security_analyst'
  systemPrompt: string
  provider: 'openai' | 'anthropic' | 'google' | 'ollama'
  model: string
}>({
  name: '',
  type: 'code_review',
  systemPrompt: '',
  provider: 'ollama',
  model: 'llama2',
})

// 创建助手
async function createAssistant() {
  if (!appStore.currentOrganizationId) return
  
  try {
    await trpc.aiAssistants.create.mutate({
      organizationId: appStore.currentOrganizationId,
      name: createForm.value.name,
      type: createForm.value.type,
      systemPrompt: createForm.value.systemPrompt,
      modelConfig: {
        provider: createForm.value.provider,
        model: createForm.value.model,
        temperature: 0.7,
        maxTokens: 2000,
      },
    })
    
    showCreateDialog.value = false
    createForm.value = {
      name: '',
      type: 'code_review',
      systemPrompt: '',
      provider: 'ollama',
      model: 'llama2',
    }
    
    // 刷新列表
    await fetchAssistants({ organizationId: appStore.currentOrganizationId })
  } catch (error) {
    log.error('Failed to create assistant:', error)
  }
}

// 助手类型映射
const assistantTypeMap: Record<string, { label: string; icon: string; color: string }> = {
  code_review: { label: '代码审查', icon: '🔍', color: 'bg-blue-500' },
  devops_engineer: { label: 'DevOps 工程师', icon: '⚙️', color: 'bg-green-500' },
  cost_optimizer: { label: '成本优化', icon: '💰', color: 'bg-yellow-500' },
  security_analyst: { label: '安全分析', icon: '🔒', color: 'bg-red-500' },
}

// 获取助手类型信息
const getAssistantTypeInfo = (type: string) => {
  return assistantTypeMap[type] || { label: type, icon: '🤖', color: 'bg-gray-500' }
}

// 格式化时间
const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// 发送消息
const sendMessage = async () => {
  if (!messageInput.value.trim() || !currentAssistant.value || chatting.value) {
    return
  }

  const message = messageInput.value.trim()
  messageInput.value = ''

  await chat(currentAssistant.value.id, message)

  // 滚动到底部
  await nextTick()
  scrollToBottom()
}

// 滚动到底部
const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

// 选择助手
const selectAssistant = (assistant: AIAssistant) => {
  setCurrentAssistant(assistant)
  showRating.value = false
}

// 提交评分
const submitRating = async () => {
  if (!currentAssistant.value || selectedRating.value === 0) return

  await rate(currentAssistant.value.id, selectedRating.value)
  showRating.value = false
  selectedRating.value = 0
}

// 获取评分星星
const getRatingStars = (rating: number | null | undefined) => {
  if (!rating) return '暂无评分'
  return '⭐'.repeat(Math.round(rating))
}

// 初始化
onMounted(async () => {
  const organizationId = appStore.currentOrganizationId
  if (organizationId) {
    await fetchAssistants({ organizationId })
    
    // 自动选择第一个助手
    if (hasAssistants.value && !currentAssistant.value && assistants.value[0]) {
      selectAssistant(assistants.value[0])
    }
  }
})
</script>

<template>
  <PageContainer title="AI 助手" description="使用 AI 助手优化您的开发和运维流程">
    <template #actions>
      <Button variant="outline" @click="showCreateDialog = true">
        <Plus class="mr-2 h-4 w-4" />
        创建助手
      </Button>
    </template>

    <div class="grid gap-6 lg:grid-cols-[300px_1fr]">
      <!-- 助手列表 -->
      <div class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle class="text-base">可用助手</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2">
            <!-- 加载状态 -->
            <div v-if="loading && !hasAssistants" class="flex items-center justify-center py-8">
              <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
            </div>

            <!-- 助手列表 -->
            <button
              v-for="assistant in assistants"
              :key="assistant.id"
              @click="selectAssistant(assistant)"
              :class="[
                'w-full text-left p-3 rounded-lg border transition-colors',
                currentAssistant?.id === assistant.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent',
              ]"
            >
              <div class="flex items-start gap-3">
                <div
                  :class="[
                    'w-10 h-10 rounded-full flex items-center justify-center text-white text-lg',
                    getAssistantTypeInfo(assistant.type).color,
                  ]"
                >
                  {{ getAssistantTypeInfo(assistant.type).icon }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{{ assistant.name }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ getAssistantTypeInfo(assistant.type).label }}
                  </div>
                  <div class="text-xs text-muted-foreground mt-1">
                    {{ getRatingStars(assistant.averageRating) }}
                  </div>
                </div>
              </div>
            </button>

            <!-- 空状态 -->
            <div v-if="!loading && !hasAssistants" class="text-center py-8">
              <Bot class="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p class="text-sm text-muted-foreground">暂无可用助手</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 对话区域 -->
      <Card class="flex flex-col h-[calc(100vh-16rem)]">
        <!-- 助手信息 -->
        <CardHeader v-if="currentAssistant" class="border-b">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                :class="[
                  'w-12 h-12 rounded-full flex items-center justify-center text-white text-xl',
                  getAssistantTypeInfo(currentAssistant.type).color,
                ]"
              >
                {{ getAssistantTypeInfo(currentAssistant.type).icon }}
              </div>
              <div>
                <CardTitle>{{ currentAssistant.name }}</CardTitle>
                <CardDescription>
                  {{ getAssistantTypeInfo(currentAssistant.type).label }}
                </CardDescription>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="ghost" size="icon" @click="showRating = !showRating">
                <Star class="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Settings class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <!-- 评分面板 -->
          <div v-if="showRating" class="mt-4 p-4 bg-accent rounded-lg">
            <p class="text-sm font-medium mb-2">为这个助手评分</p>
            <div class="flex items-center gap-2">
              <button
                v-for="star in 5"
                :key="star"
                @click="selectedRating = star"
                class="text-2xl transition-transform hover:scale-110"
              >
                {{ star <= selectedRating ? '⭐' : '☆' }}
              </button>
              <Button
                size="sm"
                @click="submitRating"
                :disabled="selectedRating === 0"
                class="ml-4"
              >
                提交评分
              </Button>
            </div>
          </div>
        </CardHeader>

        <!-- 消息列表 -->
        <div class="flex-1 p-4 overflow-y-auto">
          <div ref="chatContainer" class="space-y-4">
            <!-- 欢迎消息 -->
            <div v-if="!hasMessages && currentAssistant" class="text-center py-12">
              <Sparkles class="h-16 w-16 mx-auto text-primary mb-4" />
              <h3 class="text-lg font-semibold mb-2">开始对话</h3>
              <p class="text-sm text-muted-foreground max-w-md mx-auto">
                {{ currentAssistant.systemPrompt }}
              </p>
            </div>

            <!-- 消息列表 -->
            <div
              v-for="(message, index) in messages"
              :key="index"
              :class="[
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start',
              ]"
            >
              <!-- 助手消息 -->
              <template v-if="message.role === 'assistant'">
                <div
                  :class="[
                    'w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0',
                    currentAssistant ? getAssistantTypeInfo(currentAssistant.type).color : 'bg-gray-500',
                  ]"
                >
                  <Bot class="h-4 w-4" />
                </div>
                <div class="flex-1 max-w-[70%]">
                  <div class="bg-accent rounded-lg p-3">
                    <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>
                  </div>
                  <p class="text-xs text-muted-foreground mt-1">
                    {{ message.timestamp ? formatTime(message.timestamp) : '' }}
                  </p>
                </div>
              </template>

              <!-- 用户消息 -->
              <template v-else>
                <div class="flex-1 max-w-[70%]">
                  <div class="bg-primary text-primary-foreground rounded-lg p-3">
                    <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>
                  </div>
                  <p class="text-xs text-muted-foreground mt-1 text-right">
                    {{ message.timestamp ? formatTime(message.timestamp) : '' }}
                  </p>
                </div>
                <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                  <User class="h-4 w-4" />
                </div>
              </template>
            </div>

            <!-- 正在输入 -->
            <div v-if="chatting" class="flex gap-3">
              <div
                :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center text-white',
                  currentAssistant ? getAssistantTypeInfo(currentAssistant.type).color : 'bg-gray-500',
                ]"
              >
                <Bot class="h-4 w-4" />
              </div>
              <div class="bg-accent rounded-lg p-3">
                <div class="flex gap-1">
                  <div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0ms" />
                  <div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 150ms" />
                  <div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 300ms" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div v-if="currentAssistant" class="border-t p-4">
          <form @submit.prevent="sendMessage" class="flex gap-2">
            <Textarea
              v-model="messageInput"
              placeholder="输入消息..."
              class="min-h-[60px] max-h-[200px]"
              @keydown.enter.exact.prevent="sendMessage"
            />
            <Button
              type="submit"
              size="icon"
              :disabled="!messageInput.trim() || chatting"
              class="h-[60px] w-[60px]"
            >
              <Send v-if="!chatting" class="h-5 w-5" />
              <Loader2 v-else class="h-5 w-5 animate-spin" />
            </Button>
          </form>
          <p class="text-xs text-muted-foreground mt-2">
            按 Enter 发送，Shift + Enter 换行
          </p>
        </div>

        <!-- 未选择助手 -->
        <div v-else class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <Bot class="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 class="text-lg font-semibold mb-2">选择一个 AI 助手</h3>
            <p class="text-sm text-muted-foreground">
              从左侧列表中选择一个助手开始对话
            </p>
          </div>
        </div>
      </Card>
    </div>
  </PageContainer>
</template>

<style scoped>
@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.animate-bounce {
  animation: bounce 1s infinite;
}
</style>
