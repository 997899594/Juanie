<template>
  <div class="ai-assistant">
    <!-- 触发按钮 -->
    <button
      v-if="!isOpen"
      class="ai-trigger"
      @click="toggleAssistant"
      title="AI Assistant"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
    </button>

    <!-- 聊天窗口 -->
    <div v-if="isOpen" class="ai-chat-window">
      <!-- 头部 -->
      <div class="ai-header">
        <div class="ai-header-content">
          <div class="ai-avatar">🤖</div>
          <div>
            <h3>AI Assistant</h3>
            <p class="ai-status">{{ isTyping ? 'Typing...' : 'Online' }}</p>
          </div>
        </div>
        <button class="ai-close" @click="toggleAssistant">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- 消息列表 -->
      <div ref="messagesContainer" class="ai-messages">
        <div v-if="messages.length === 0" class="ai-welcome">
          <div class="ai-welcome-icon">👋</div>
          <h4>Hi! I'm your AI assistant</h4>
          <p>I can help you with:</p>
          <ul>
            <li>Creating new projects</li>
            <li>Deploying applications</li>
            <li>Troubleshooting issues</li>
            <li>Generating configurations</li>
          </ul>
        </div>

        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="['ai-message', `ai-message-${message.role}`]"
        >
          <div class="ai-message-avatar">
            {{ message.role === 'user' ? '👤' : '🤖' }}
          </div>
          <div class="ai-message-content">
            <div class="ai-message-text">{{ message.content }}</div>
            <div class="ai-message-time">
              {{ formatTime(message.timestamp) }}
            </div>
          </div>
        </div>

        <!-- 加载指示器 -->
        <div v-if="isTyping" class="ai-message ai-message-assistant">
          <div class="ai-message-avatar">🤖</div>
          <div class="ai-message-content">
            <div class="ai-typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 建议 -->
      <div v-if="suggestions.length > 0" class="ai-suggestions">
        <button
          v-for="(suggestion, index) in suggestions"
          :key="index"
          class="ai-suggestion"
          @click="sendMessage(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>

      <!-- 输入框 -->
      <div class="ai-input-container">
        <input
          v-model="inputMessage"
          type="text"
          placeholder="Type your message..."
          class="ai-input"
          @keypress.enter="handleSend"
          :disabled="isTyping"
        />
        <button
          class="ai-send"
          @click="handleSend"
          :disabled="!inputMessage.trim() || isTyping"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { log } from '@juanie/ui'
import { ref, nextTick, watch } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/composables/useToast'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const toastHelper = useToast()

const isOpen = ref(false)
const messages = ref<Message[]>([])
const inputMessage = ref('')
const isTyping = ref(false)
const suggestions = ref<string[]>([])
const messagesContainer = ref<HTMLElement>()

const toggleAssistant = () => {
  isOpen.value = !isOpen.value
}

const handleSend = async () => {
  if (!inputMessage.value.trim() || isTyping.value) return

  await sendMessage(inputMessage.value)
  inputMessage.value = ''
}

const sendMessage = async (message: string) => {
  try {
    // 添加用户消息
    messages.value.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    })

    // 滚动到底部
    await scrollToBottom()

    // 显示输入中状态
    isTyping.value = true

    // 调用 AI 聊天接口
    const response = await trpc.ai.chat.mutate({
      message,
      context: {
        // 可以传递当前页面的上下文
        currentRoute: window.location.pathname,
      },
    })

    // 添加助手响应
    messages.value.push({
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
    })

    // 更新建议
    suggestions.value = response.suggestions || []

    // 如果有需要确认的操作
    if (response.action) {
      // TODO: 显示确认对话框
      log.info('Action to confirm:', response.action)
    }

    // 滚动到底部
    await scrollToBottom()
  } catch (error) {
    log.error('Failed to send message:', error)
    toastHelper.error('Failed to send message. Please try again.')
  } finally {
    isTyping.value = false
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
  }).format(date)
}

// 监听打开状态，滚动到底部
watch(isOpen, async (newValue) => {
  if (newValue) {
    await scrollToBottom()
  }
})
</script>

<style scoped>
.ai-assistant {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}

.ai-trigger {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.ai-trigger:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.ai-chat-window {
  width: 380px;
  height: 600px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ai-header {
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ai-header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-avatar {
  font-size: 32px;
}

.ai-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.ai-status {
  margin: 0;
  font-size: 12px;
  opacity: 0.9;
}

.ai-close {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.ai-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-welcome {
  text-align: center;
  padding: 32px 16px;
}

.ai-welcome-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.ai-welcome h4 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.ai-welcome p {
  margin: 0 0 12px 0;
  color: #666;
}

.ai-welcome ul {
  list-style: none;
  padding: 0;
  margin: 0;
  text-align: left;
  display: inline-block;
}

.ai-welcome li {
  padding: 4px 0;
  color: #666;
}

.ai-welcome li::before {
  content: '✓ ';
  color: #667eea;
  font-weight: bold;
}

.ai-message {
  display: flex;
  gap: 8px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ai-message-avatar {
  font-size: 24px;
  flex-shrink: 0;
}

.ai-message-content {
  flex: 1;
}

.ai-message-text {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 12px;
  line-height: 1.5;
}

.ai-message-user .ai-message-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.ai-message-time {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  padding: 0 4px;
}

.ai-typing {
  display: flex;
  gap: 4px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 12px;
  width: fit-content;
}

.ai-typing span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  animation: typing 1.4s infinite;
}

.ai-typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.ai-typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
}

.ai-suggestions {
  padding: 8px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-top: 1px solid #eee;
}

.ai-suggestion {
  padding: 6px 12px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-suggestion:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.ai-input-container {
  padding: 16px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 8px;
}

.ai-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 24px;
  outline: none;
  font-size: 14px;
}

.ai-input:focus {
  border-color: #667eea;
}

.ai-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.ai-send {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.ai-send:hover:not(:disabled) {
  transform: scale(1.1);
}

.ai-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
