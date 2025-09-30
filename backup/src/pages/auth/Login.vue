<template>
  <div class="login-container">
    <!-- 动态背景 -->
    <div class="animated-background">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="gradient-orb orb-3"></div>
      <div class="floating-particles">
        <div class="particle" v-for="i in 20" :key="i" :style="getParticleStyle(i)"></div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧品牌区域 -->
      <div class="brand-section">
        <div class="brand-content">
          <!-- Logo区域 -->
          <div class="logo-section">
            <div class="logo-container">
              <div class="logo-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/>
                </svg>
              </div>
            </div>
            <h1 class="brand-title">DevOps Platform</h1>
            <p class="brand-subtitle">现代化的开发运维管理平台</p>
          </div>

          <!-- 特性卡片 -->
          <div class="feature-cards">
            <div class="feature-card" v-for="(feature, index) in features" :key="index">
              <div class="feature-icon">
                <component :is="feature.icon" />
              </div>
              <div class="feature-text">
                <h3>{{ feature.title }}</h3>
                <p>{{ feature.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录区域 -->
      <div class="login-section">
        <div class="login-card">
          <!-- 登录卡片头部 -->
          <div class="login-header">
            <h2 class="login-title">欢迎回来</h2>
            <p class="login-subtitle">登录您的账户以继续使用</p>
          </div>

          <!-- 登录表单 -->
          <form @submit.prevent="handleLogin" class="login-form">
            <!-- 用户名输入框 -->
            <div class="input-group">
              <input
                v-model="loginForm.username"
                type="text"
                id="username"
                class="input-field"
                placeholder=" "
                required
              />
              <label for="username" class="floating-label">用户名</label>
            </div>

            <!-- 密码输入框 -->
            <div class="input-group">
              <input
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                id="password"
                class="input-field"
                placeholder=" "
                required
              />
              <label for="password" class="floating-label">密码</label>
              <button
                type="button"
                class="password-toggle"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                </svg>
              </button>
            </div>

            <!-- 记住我选项 -->
            <div class="form-options">
              <label class="checkbox-label">
                <input v-model="loginForm.rememberMe" type="checkbox" class="checkbox-input" />
                <span class="checkbox-custom"></span>
                <span class="checkbox-text">记住我</span>
              </label>
              <a href="#" class="forgot-link">忘记密码？</a>
            </div>

            <!-- 登录按钮 -->
            <button type="submit" class="login-btn" :disabled="isLoading">
              <span v-if="!isLoading" class="btn-text">登录</span>
              <div v-else class="btn-loading">
                <div class="loading-spinner"></div>
                <span>登录中...</span>
              </div>
            </button>
          </form>

          <!-- 分割线 -->
          <div class="divider">
            <span class="divider-text">或者</span>
          </div>

          <!-- 演示账户 -->
          <div class="demo-accounts">
            <h3 class="demo-title">演示账户</h3>
            <div class="demo-cards">
              <div
                v-for="(account, index) in demoAccounts"
                :key="index"
                class="demo-card"
                @click="selectDemoAccount(account)"
              >
                <div class="demo-avatar">
                  <span>{{ account.username.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="demo-info">
                  <div class="demo-name">{{ account.username }}</div>
                  <div class="demo-role">{{ account.role }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 响应式数据
const showPassword = ref(false)
const isLoading = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
  rememberMe: false
})

// 特性数据
const features = ref([
  {
    icon: 'RocketIcon',
    title: '快速部署',
    description: '一键部署，极速上线'
  },
  {
    icon: 'ShieldIcon', 
    title: '安全可靠',
    description: '企业级安全保障'
  },
  {
    icon: 'MonitorIcon',
    title: '实时监控',
    description: '全方位性能监控'
  }
])

// 演示账户
const demoAccounts = ref([
  { username: 'admin', password: 'admin123', role: '系统管理员' },
  { username: 'developer', password: 'dev123', role: '开发工程师' },
  { username: 'ops', password: 'ops123', role: '运维工程师' }
])

// 粒子样式生成
const getParticleStyle = (index: number) => {
  const delay = Math.random() * 20
  const duration = 15 + Math.random() * 10
  const size = 2 + Math.random() * 4
  
  return {
    left: Math.random() * 100 + '%',
    animationDelay: delay + 's',
    animationDuration: duration + 's',
    width: size + 'px',
    height: size + 'px'
  }
}

// 登录处理
const handleLogin = async () => {
  if (!loginForm.username || !loginForm.password) {
    return
  }

  isLoading.value = true
  
  try {
    // 模拟登录请求
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // 登录成功，跳转到仪表板
    router.push('/dashboard')
  } catch (error) {
    console.error('登录失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 选择演示账户
const selectDemoAccount = (account: any) => {
  loginForm.username = account.username
  loginForm.password = account.password
}

// 组件挂载
onMounted(() => {
  // 添加进入动画
  document.querySelector('.login-container')?.classList.add('animate-fade-in')
})
</script>

<style scoped>
/* B站风格设计变量 */
:root {
  /* B站经典色彩 */
  --bilibili-pink: #FB7299;
  --bilibili-blue: #00A1D6;
  --bilibili-pink-light: #FF8BB4;
  --bilibili-pink-dark: #E85A7A;
  --bilibili-blue-light: #1AB3E8;
  --bilibili-blue-dark: #0088B8;
  
  /* 渐变色 */
  --gradient-pink-blue: linear-gradient(135deg, #FB7299 0%, #00A1D6 100%);
  --gradient-pink-light: linear-gradient(135deg, #FF8BB4 0%, #FB7299 100%);
  --gradient-blue-light: linear-gradient(135deg, #1AB3E8 0%, #00A1D6 100%);
  --gradient-animated: linear-gradient(-45deg, #FB7299, #FF8BB4, #00A1D6, #1AB3E8);
  
  /* 背景色 */
  --bg-primary: #FFFFFF;
  --bg-glass: rgba(255, 255, 255, 0.9);
  --bg-glass-strong: rgba(255, 255, 255, 0.95);
  
  /* 文本色 */
  --text-primary: #212529;
  --text-secondary: #6C757D;
  --text-tertiary: #ADB5BD;
  --text-inverse: #FFFFFF;
  
  /* 边框色 */
  --border-light: #E9ECEF;
  --border-medium: #DEE2E6;
  --border-focus: var(--bilibili-pink);
  
  /* 阴影系统 */
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.16);
  --shadow-2xl: 0 24px 64px rgba(0, 0, 0, 0.20);
  --shadow-neon: 0 0 20px rgba(251, 114, 153, 0.3), 0 0 40px rgba(0, 161, 214, 0.2);
  
  /* 圆角系统 */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 28px;
  --radius-3xl: 36px;
  --radius-full: 9999px;
  
  /* 间距系统 */
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;
  --spacing-20: 80px;
  
  /* 缓动函数 */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  
  /* 动画时长 */
  --duration-fast: 0.15s;
  --duration-normal: 0.3s;
  --duration-slow: 0.5s;
  --duration-slower: 0.8s;
}

/* 主容器 */
.login-container {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  overflow: hidden;
  font-family: "PingFang SC", "Source Han Sans CN", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
}

/* 动态背景 */
.animated-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--gradient-animated);
  background-size: 400% 400%;
  animation: gradientShift 8s ease infinite;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* 渐变球体 */
.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.7;
  animation: float 6s ease-in-out infinite;
}

.orb-1 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(251, 114, 153, 0.8) 0%, rgba(251, 114, 153, 0.2) 70%);
  top: 10%;
  left: 10%;
  animation-delay: 0s;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(0, 161, 214, 0.6) 0%, rgba(0, 161, 214, 0.1) 70%);
  top: 50%;
  right: 10%;
  animation-delay: 2s;
}

.orb-3 {
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, rgba(255, 139, 180, 0.7) 0%, rgba(255, 139, 180, 0.2) 70%);
  bottom: 20%;
  left: 30%;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-30px) rotate(120deg); }
  66% { transform: translateY(20px) rotate(240deg); }
}

/* 浮动粒子 */
.floating-particles {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.particle {
  position: absolute;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  animation: particleFloat 20s linear infinite;
}

@keyframes particleFloat {
  0% {
    transform: translateY(100vh) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) rotate(360deg);
    opacity: 0;
  }
}

/* 主要内容区域 */
.main-content {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
  max-width: 1600px;
  margin: 0 auto;
  gap: var(--spacing-20);
  padding: var(--spacing-12);
}

/* 左侧品牌区域 */
.brand-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-16);
}

.brand-content {
  text-align: center;
  color: var(--text-inverse);
}

/* Logo区域 */
.logo-section {
  margin-bottom: var(--spacing-16);
}

.logo-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  background: var(--bg-glass);
  border-radius: var(--radius-3xl);
  margin-bottom: var(--spacing-8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: var(--shadow-2xl);
  animation: logoGlow 3s ease-in-out infinite alternate;
}

@keyframes logoGlow {
  0% { box-shadow: var(--shadow-2xl); }
  100% { box-shadow: var(--shadow-neon); }
}

.logo-icon {
  width: 60px;
  height: 60px;
  color: var(--bilibili-pink);
}

.logo-icon svg {
  width: 100%;
  height: 100%;
}

.brand-title {
  font-size: 48px;
  font-weight: 700;
  margin-bottom: var(--spacing-4);
  background: linear-gradient(135deg, #FFFFFF 0%, rgba(255, 255, 255, 0.8) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.brand-subtitle {
  font-size: 20px;
  opacity: 0.9;
  font-weight: 400;
}

/* 特性卡片 */
.feature-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
  margin-top: var(--spacing-12);
}

.feature-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-5);
  padding: var(--spacing-6);
  background: var(--bg-glass);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all var(--duration-normal) var(--ease-out-quart);
  cursor: pointer;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
  border-color: rgba(251, 114, 153, 0.3);
}

.feature-icon {
  width: 48px;
  height: 48px;
  background: var(--gradient-pink-blue);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-inverse);
  flex-shrink: 0;
}

.feature-text h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: var(--spacing-2);
  color: var(--text-primary);
}

.feature-text p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* 右侧登录区域 */
.login-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-12);
}

.login-card {
  width: 100%;
  max-width: 520px;
  background: var(--bg-glass-strong);
  backdrop-filter: blur(40px);
  border-radius: var(--radius-3xl);
  padding: var(--spacing-16);
  box-shadow: var(--shadow-2xl);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: cardSlideIn var(--duration-slower) var(--ease-bounce);
}

@keyframes cardSlideIn {
  0% {
    opacity: 0;
    transform: translateX(50px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

/* 登录头部 */
.login-header {
  text-align: center;
  margin-bottom: var(--spacing-12);
}

.login-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-3);
  background: var(--gradient-pink-blue);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  margin: 0;
}

/* 登录表单 */
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-8);
}

/* 输入框组 */
.input-group {
  position: relative;
}

.input-field {
  width: 100%;
  padding: var(--spacing-5) var(--spacing-5);
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-lg);
  font-size: 16px;
  font-family: inherit;
  background: var(--bg-primary);
  transition: all var(--duration-normal) var(--ease-out-quart);
  outline: none;
  min-height: 56px;
  box-sizing: border-box;
}

.input-field:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 4px rgba(251, 114, 153, 0.1);
  transform: translateY(-2px);
}

/* 浮动标签 */
.floating-label {
  position: absolute;
  left: var(--spacing-5);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 16px;
  pointer-events: none;
  transition: all var(--duration-normal) var(--ease-out-quart);
  background: var(--bg-primary);
  padding: 0 var(--spacing-2);
}

.input-field:focus + .floating-label,
.input-field:not(:placeholder-shown) + .floating-label {
  top: 0;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--bilibili-pink);
  font-weight: 600;
}

/* 密码切换按钮 */
.password-toggle {
  position: absolute;
  right: var(--spacing-4);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--spacing-2);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) var(--ease-out-quart);
}

.password-toggle:hover {
  color: var(--bilibili-pink);
  background: rgba(251, 114, 153, 0.1);
}

.password-toggle svg {
  width: 20px;
  height: 20px;
}

/* 表单选项 */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: var(--spacing-4) 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
}

.checkbox-input {
  display: none;
}

.checkbox-custom {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-sm);
  position: relative;
  transition: all var(--duration-normal) var(--ease-out-quart);
}

.checkbox-input:checked + .checkbox-custom {
  background: var(--gradient-pink-blue);
  border-color: var(--bilibili-pink);
}

.checkbox-input:checked + .checkbox-custom::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.forgot-link {
  color: var(--bilibili-pink);
  text-decoration: none;
  font-size: 14px;
  transition: all var(--duration-fast) var(--ease-out-quart);
}

.forgot-link:hover {
  color: var(--bilibili-pink-dark);
  text-decoration: underline;
}

/* 登录按钮 */
.login-btn {
  background: var(--gradient-pink-blue);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-lg);
  padding: var(--spacing-5) var(--spacing-8);
  font-weight: 600;
  font-size: 18px;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out-quart);
  box-shadow: var(--shadow-md);
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-3);
  margin-top: var(--spacing-4);
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl);
  background: linear-gradient(135deg, #FF8BB4 0%, #1AB3E8 100%);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: var(--shadow-md);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-loading {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 分割线 */
.divider {
  position: relative;
  text-align: center;
  margin: var(--spacing-10) 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border-light);
}

.divider-text {
  background: var(--bg-glass-strong);
  padding: 0 var(--spacing-4);
  color: var(--text-tertiary);
  font-size: 14px;
}

/* 演示账户 */
.demo-accounts {
  margin-top: var(--spacing-8);
}

.demo-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-6);
  text-align: center;
}

.demo-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.demo-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out-quart);
  background: rgba(255, 255, 255, 0.5);
}

.demo-card:hover {
  border-color: var(--bilibili-pink);
  background: rgba(251, 114, 153, 0.05);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.demo-avatar {
  width: 40px;
  height: 40px;
  background: var(--gradient-pink-blue);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 16px;
}

.demo-info {
  flex: 1;
}

.demo-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
}

.demo-role {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 2px;
}

/* 进入动画 */
.animate-fade-in {
  animation: fadeIn var(--duration-slower) var(--ease-out-quart);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
    gap: var(--spacing-12);
  }
  
  .brand-section {
    order: 2;
    padding: var(--spacing-8);
  }
  
  .login-section {
    order: 1;
    padding: var(--spacing-8);
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: var(--spacing-6);
  }
  
  .login-card {
    padding: var(--spacing-8);
  }
  
  .brand-title {
    font-size: 36px;
  }
  
  .feature-cards {
    margin-top: var(--spacing-8);
  }
}
</style>