<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo-section">
        <div class="logo">🚀</div>
        <h1>欢迎使用 Juanie</h1>
        <p>选择您的登录方式</p>
      </div>
      
      <div class="login-buttons">
        <button 
          @click="handleGitHubLogin" 
          class="login-btn github-btn"
          :disabled="loading"
        >
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span v-if="!loading">使用 GitHub 登录</span>
          <span v-else class="loading-text">
            <div class="spinner"></div>
            正在登录...
          </span>
        </button>
        
        <button 
          @click="handleGitLabLogin" 
          class="login-btn gitlab-btn"
          :disabled="loading"
        >
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.16l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.16l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.94z"/>
          </svg>
          <span v-if="!loading">使用 GitLab 登录</span>
          <span v-else class="loading-text">
            <div class="spinner"></div>
            正在登录...
          </span>
        </button>
      </div>
      
      <!-- 错误提示 -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      
      <div class="footer">
        <p>登录即表示您同意我们的服务条款和隐私政策</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const error = ref('')

// 检查认证状态
const checkAuthStatus = async () => {
  try {
    // 这里应该调用你的认证检查 API
    // 暂时使用延迟模拟
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 假设登录成功，跳转到 Dashboard
    router.push('/dashboard')
  } catch (error) {
    console.error('检查认证状态失败:', error)
  }
}

const handleGitHubLogin = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const authUrl = await authStore.getGitHubAuthUrl()
    // 直接跳转到认证页面
    window.location.href = authUrl
  } catch (err) {
    console.error('获取 GitHub 授权 URL 失败:', err)
    loading.value = false
    error.value = '获取登录链接失败，请重试'
  }
}

const handleGitLabLogin = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const authUrl = await authStore.getGitLabAuthUrl()
    // 直接跳转到认证页面
    window.location.href = authUrl
  } catch (err) {
    console.error('获取 GitLab 授权 URL 失败:', err)
    loading.value = false
    error.value = '获取登录链接失败，请重试'
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
}

.login-card {
  background: white;
  border-radius: 20px;
  padding: 3rem 2rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.logo-section {
  margin-bottom: 2rem;
}

.logo {
  font-size: 3rem;
  margin-bottom: 1rem;
}

h1 {
  font-size: 1.8rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.logo-section p {
  color: #6b7280;
  font-size: 1rem;
}

.login-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  min-height: 56px;
}

.login-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.github-btn {
  background: #24292e;
  color: white;
}

.github-btn:hover:not(:disabled) {
  background: #1a1e22;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(36, 41, 46, 0.3);
}

.gitlab-btn {
  background: #fc6d26;
  color: white;
}

.gitlab-btn:hover:not(:disabled) {
  background: #e85d1f;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(252, 109, 38, 0.3);
}

.icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.loading-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.footer {
  border-top: 1px solid #e5e7eb;
  padding-top: 1.5rem;
}

.footer p {
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1.4;
}

@media (max-width: 480px) {
  .login-card {
    padding: 2rem 1.5rem;
  }
  
  h1 {
    font-size: 1.5rem;
  }
  
  .login-btn {
    padding: 0.875rem 1.25rem;
    font-size: 0.9rem;
  }
}
</style>