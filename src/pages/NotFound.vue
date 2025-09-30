<template>
  <div class="not-found-page">
    <div class="not-found-container">
      <!-- 404 图标和数字 -->
      <div class="error-visual mb-8">
        <div class="error-number">
          <span class="gradient-text-bilibili">404</span>
        </div>
        <div class="error-icon">
          <span class="text-6xl">🔍</span>
        </div>
      </div>
      
      <!-- 错误信息 -->
      <div class="error-content text-center mb-8">
        <h1 class="text-3xl font-bold text-bilibili-primary mb-4">
          页面未找到
        </h1>
        <p class="text-lg text-bilibili-secondary mb-2">
          抱歉，您访问的页面不存在或已被移动
        </p>
        <p class="text-sm text-bilibili-muted">
          请检查 URL 是否正确，或返回首页继续浏览
        </p>
      </div>
      
      <!-- 操作按钮 -->
      <div class="error-actions">
        <div class="flex-center gap-bilibili-md">
          <n-button 
            type="primary" 
            size="large"
            class="btn-bilibili animate-bilibili-hover"
            @click="goHome"
          >
            🏠 返回首页
          </n-button>
          
          <n-button 
            quaternary 
            size="large"
            class="btn-bilibili animate-bilibili-hover"
            @click="goBack"
          >
            ← 返回上页
          </n-button>
        </div>
      </div>
      
      <!-- 建议链接 -->
      <div class="suggestions mt-12">
        <h3 class="text-lg font-semibold text-bilibili-primary mb-4 text-center">
          您可能想要访问：
        </h3>
        
        <div class="suggestion-grid">
          <div 
            v-for="suggestion in suggestions" 
            :key="suggestion.path"
            class="suggestion-card card-bilibili animate-bilibili-hover"
            @click="navigateTo(suggestion.path)"
          >
            <div class="suggestion-icon mb-3">
              <span class="text-2xl">{{ suggestion.icon }}</span>
            </div>
            <h4 class="font-semibold text-bilibili-primary mb-2">
              {{ suggestion.title }}
            </h4>
            <p class="text-sm text-bilibili-secondary">
              {{ suggestion.description }}
            </p>
          </div>
        </div>
      </div>
      
      <!-- 搜索建议 -->
      <div class="search-section mt-8">
        <n-card class="card-bilibili">
          <template #header>
            <div class="flex-center gap-bilibili-sm">
              <span class="text-xl">🔍</span>
              <span>搜索您需要的内容</span>
            </div>
          </template>
          
          <div class="search-form">
            <n-input-group>
              <n-input 
                v-model:value="searchQuery"
                placeholder="输入关键词搜索..."
                size="large"
                @keyup.enter="handleSearch"
              />
              <n-button 
                type="primary" 
                size="large"
                class="btn-bilibili"
                @click="handleSearch"
              >
                搜索
              </n-button>
            </n-input-group>
          </div>
        </n-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const searchQuery = ref('')

// 建议页面
const suggestions = ref([
  {
    title: '仪表盘',
    description: '查看项目概览和统计信息',
    icon: '📊',
    path: '/'
  },
  {
    title: '项目管理',
    description: '管理您的开发项目',
    icon: '📁',
    path: '/projects'
  },
  {
    title: '部署中心',
    description: '应用部署和发布管理',
    icon: '🚀',
    path: '/deploy'
  },
  {
    title: '系统监控',
    description: '实时监控系统状态',
    icon: '📈',
    path: '/monitor'
  }
])

// 返回首页
const goHome = () => {
  router.push('/')
}

// 返回上一页
const goBack = () => {
  if (window.history.length > 1) {
    router.go(-1)
  } else {
    router.push('/')
  }
}

// 导航到指定页面
const navigateTo = (path: string) => {
  router.push(path)
}

// 处理搜索
const handleSearch = () => {
  if (searchQuery.value.trim()) {
    console.log('搜索:', searchQuery.value)
    // 这里可以实现搜索功能
    // router.push(`/search?q=${encodeURIComponent(searchQuery.value)}`)
  }
}
</script>

<style scoped>
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-6);
  background: var(--bg-page);
}

.not-found-container {
  max-width: 800px;
  width: 100%;
}

.error-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-8);
  margin-bottom: var(--spacing-8);
}

.error-number {
  font-size: 8rem;
  font-weight: var(--font-weight-black);
  line-height: 1;
  background: var(--gradient-bilibili);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: pulse-glow 2s ease-in-out infinite alternate;
}

.error-icon {
  animation: float 3s ease-in-out infinite;
}

.error-content {
  text-align: center;
}

.error-actions {
  display: flex;
  justify-content: center;
}

.suggestions {
  text-align: center;
}

.suggestion-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-4);
  margin-top: var(--spacing-6);
}

.suggestion-card {
  padding: var(--spacing-6);
  text-align: center;
  cursor: pointer;
  border-radius: var(--radius-xl);
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  transition: all var(--duration-normal) var(--ease-out-quart);
}

.suggestion-card:hover {
  transform: translateY(-4px);
  border-color: var(--border-accent);
  box-shadow: var(--shadow-lg);
}

.suggestion-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto;
  border-radius: var(--radius-full);
  background: var(--gradient-soft);
}

.search-section {
  max-width: 500px;
  margin: 0 auto;
}

.search-form {
  width: 100%;
}

/* 动画效果 */
@keyframes pulse-glow {
  0% {
    filter: drop-shadow(0 0 10px var(--bilibili-pink-light));
  }
  100% {
    filter: drop-shadow(0 0 20px var(--bilibili-pink)) drop-shadow(0 0 30px var(--bilibili-pink-light));
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .not-found-page {
    padding: var(--spacing-4);
  }
  
  .error-visual {
    flex-direction: column;
    gap: var(--spacing-4);
  }
  
  .error-number {
    font-size: 6rem;
  }
  
  .suggestion-grid {
    grid-template-columns: 1fr;
  }
  
  .error-actions .flex-center {
    flex-direction: column;
    gap: var(--spacing-3);
  }
}

@media (max-width: 480px) {
  .error-number {
    font-size: 4rem;
  }
  
  .error-content h1 {
    font-size: 1.5rem;
  }
  
  .error-content p {
    font-size: 0.875rem;
  }
}
</style>