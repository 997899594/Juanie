<template>
  <div class="register-page">
    <n-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      size="large"
      @submit.prevent="handleSubmit"
    >
      <div class="form-header">
        <h2>注册</h2>
        <p>创建您的DevOps平台账号</p>
      </div>

      <n-form-item path="username" label="用户名">
        <n-input
          v-model:value="formData.username"
          placeholder="请输入用户名"
          :input-props="{ autocomplete: 'username' }"
        >
          <template #prefix>
            <User class="w-4 h-4 text-slate-400" />
          </template>
        </n-input>
      </n-form-item>

      <n-form-item path="email" label="邮箱">
        <n-input
          v-model:value="formData.email"
          placeholder="请输入邮箱地址"
          :input-props="{ autocomplete: 'email' }"
        >
          <template #prefix>
            <Mail class="w-4 h-4 text-slate-400" />
          </template>
        </n-input>
      </n-form-item>

      <n-form-item path="fullName" label="姓名">
        <n-input
          v-model:value="formData.fullName"
          placeholder="请输入真实姓名"
          :input-props="{ autocomplete: 'name' }"
        >
          <template #prefix>
            <UserCheck class="w-4 h-4 text-slate-400" />
          </template>
        </n-input>
      </n-form-item>

      <n-form-item path="password" label="密码">
        <n-input
          v-model:value="formData.password"
          type="password"
          placeholder="请输入密码"
          show-password-on="click"
          :input-props="{ autocomplete: 'new-password' }"
        >
          <template #prefix>
            <Lock class="w-4 h-4 text-slate-400" />
          </template>
        </n-input>
      </n-form-item>

      <n-form-item path="confirmPassword" label="确认密码">
        <n-input
          v-model:value="formData.confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          show-password-on="click"
          :input-props="{ autocomplete: 'new-password' }"
        >
          <template #prefix>
            <ShieldCheck class="w-4 h-4 text-slate-400" />
          </template>
        </n-input>
      </n-form-item>

      <!-- Password Strength Indicator -->
      <div class="password-strength" v-if="formData.password">
        <div class="strength-label">密码强度：</div>
        <div class="strength-bar">
          <div 
            class="strength-fill" 
            :class="passwordStrength.class"
            :style="{ width: passwordStrength.width }"
          ></div>
        </div>
        <div class="strength-text" :class="passwordStrength.class">
          {{ passwordStrength.text }}
        </div>
      </div>

      <div class="form-options">
        <n-checkbox v-model:checked="agreeTerms">
          我已阅读并同意
          <n-button text type="primary" size="small">
            服务条款
          </n-button>
          和
          <n-button text type="primary" size="small">
            隐私政策
          </n-button>
        </n-checkbox>
      </div>

      <n-form-item>
        <n-button
          type="primary"
          size="large"
          :loading="authStore.isLoading"
          :disabled="!isFormValid"
          attr-type="submit"
          block
          strong
        >
          <template #icon>
            <UserPlus class="w-4 h-4" />
          </template>
          注册
        </n-button>
      </n-form-item>

      <div class="form-footer">
        <span class="text-slate-400">已有账号？</span>
        <router-link to="/login" class="login-link">
          立即登录
        </router-link>
      </div>
    </n-form>

    <!-- Features Preview -->
    <div class="features-preview">
      <div class="features-header">
        <h3>平台特性</h3>
        <p>企业级DevOps解决方案</p>
      </div>
      
      <div class="features-grid">
        <div 
          v-for="feature in features" 
          :key="feature.title"
          class="feature-item"
        >
          <div class="feature-icon" :style="{ background: feature.color }">
            <component :is="feature.icon" class="w-5 h-5" />
          </div>
          <div class="feature-content">
            <div class="feature-title">{{ feature.title }}</div>
            <div class="feature-desc">{{ feature.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  NForm, 
  NFormItem, 
  NInput, 
  NButton, 
  NCheckbox,
  useMessage,
  type FormInst,
  type FormRules
} from 'naive-ui'
import { 
  User, 
  Mail, 
  Lock, 
  UserCheck, 
  ShieldCheck, 
  UserPlus,
  GitBranch,
  Zap,
  Shield,
  BarChart3
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()

const formRef = ref<FormInst | null>(null)
const agreeTerms = ref(false)

const formData = ref({
  username: '',
  email: '',
  fullName: '',
  password: '',
  confirmPassword: ''
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度为3-20位', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: '用户名只能包含字母、数字、下划线和连字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ],
  fullName: [
    { required: true, message: '请输入真实姓名', trigger: 'blur' },
    { min: 2, max: 50, message: '姓名长度为2-50位', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少8位', trigger: 'blur' },
    { 
      validator: (rule, value) => {
        if (!value) return true
        const hasLower = /[a-z]/.test(value)
        const hasUpper = /[A-Z]/.test(value)
        const hasNumber = /\d/.test(value)
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value)
        
        if (!(hasLower && hasUpper && hasNumber && hasSpecial)) {
          return new Error('密码必须包含大小写字母、数字和特殊字符')
        }
        return true
      },
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value) => {
        if (value !== formData.value.password) {
          return new Error('两次输入的密码不一致')
        }
        return true
      },
      trigger: 'blur'
    }
  ]
}

const features = [
  {
    title: 'CI/CD流水线',
    description: '自动化构建、测试和部署',
    icon: GitBranch,
    color: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
  },
  {
    title: '性能监控',
    description: '实时应用性能监控',
    icon: BarChart3,
    color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
  },
  {
    title: '安全扫描',
    description: '代码安全漏洞检测',
    icon: Shield,
    color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
  },
  {
    title: '快速部署',
    description: '一键部署到多环境',
    icon: Zap,
    color: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
  }
]

const passwordStrength = computed(() => {
  const password = formData.value.password
  if (!password) return { width: '0%', class: '', text: '' }

  let score = 0
  let feedback = []

  // Length check
  if (password.length >= 8) score += 1
  else feedback.push('至少8位')

  // Character variety checks
  if (/[a-z]/.test(password)) score += 1
  else feedback.push('小写字母')

  if (/[A-Z]/.test(password)) score += 1
  else feedback.push('大写字母')

  if (/\d/.test(password)) score += 1
  else feedback.push('数字')

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1
  else feedback.push('特殊字符')

  const strengthLevels = [
    { width: '20%', class: 'strength-weak', text: '很弱' },
    { width: '40%', class: 'strength-weak', text: '弱' },
    { width: '60%', class: 'strength-medium', text: '中等' },
    { width: '80%', class: 'strength-good', text: '良好' },
    { width: '100%', class: 'strength-strong', text: '强' }
  ]

  return strengthLevels[score - 1] || strengthLevels[0]
})

const isFormValid = computed(() => {
  return (
    formData.value.username &&
    formData.value.email &&
    formData.value.fullName &&
    formData.value.password &&
    formData.value.confirmPassword &&
    agreeTerms.value
  )
})

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    
    const result = await authStore.register({
      username: formData.value.username,
      email: formData.value.email,
      fullName: formData.value.fullName,
      password: formData.value.password
    })

    if (result.success) {
      message.success('注册成功！正在跳转到登录页面...')
      setTimeout(() => {
        router.push('/login')
      }, 1500)
    } else {
      message.error(result.error || '注册失败')
    }
  } catch (error) {
    console.error('Register validation error:', error)
  }
}

onMounted(() => {
  // Auto-focus username input
  const usernameInput = document.querySelector('input[autocomplete="username"]') as HTMLInputElement
  if (usernameInput) {
    usernameInput.focus()
  }
})
</script>

<style scoped>
.register-page {
  @apply space-y-8;
}

.form-header {
  @apply text-center mb-8;
}

.form-header h2 {
  @apply text-2xl font-bold text-soft-800 mb-2;
}

.form-header p {
  @apply text-soft-600;
}

/* Password Strength */
.password-strength {
  @apply flex items-center gap-3 mb-4 text-sm;
}

.strength-label {
  @apply text-soft-600 whitespace-nowrap;
}

.strength-bar {
  @apply flex-1 h-2 bg-soft-200 rounded-full overflow-hidden;
}

.strength-fill {
  @apply h-full transition-all duration-300 rounded-full;
}

.strength-weak {
  @apply bg-red-500 text-red-600;
}

.strength-medium {
  @apply bg-yellow-500 text-yellow-600;
}

.strength-good {
  @apply bg-blue-500 text-blue-600;
}

.strength-strong {
  @apply bg-green-500 text-green-600;
}

.strength-text {
  @apply whitespace-nowrap font-medium;
}

.form-options {
  @apply mb-6;
}

.form-footer {
  @apply text-center mt-6;
}

.login-link {
  @apply text-primary-600 hover:text-primary-700 ml-2 transition-colors duration-200 no-underline;
}

/* Features Preview */
.features-preview {
  @apply mt-8 p-6 rounded-2xl;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.3);
  backdrop-filter: blur(20px);
}

.features-header {
  @apply text-center mb-6;
}

.features-header h3 {
  @apply text-lg font-semibold text-soft-800 mb-1;
}

.features-header p {
  @apply text-sm text-soft-600;
}

.features-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 gap-4;
}

.feature-item {
  @apply flex items-start gap-3 p-4 rounded-xl;
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.2);
}

.feature-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0;
}

.feature-content {
  @apply flex-1;
}

.feature-title {
  @apply text-sm font-medium text-soft-800 mb-1;
}

.feature-desc {
  @apply text-xs text-soft-600;
}

/* Form Styling Overrides */
:deep(.n-form-item-label) {
  @apply text-soft-700 font-medium;
}

:deep(.n-input) {
  @apply bg-white border-soft-300;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

:deep(.n-input:hover) {
  @apply border-soft-400;
}

:deep(.n-input.n-input--focus) {
  @apply border-primary-500;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

:deep(.n-input__input-el) {
  @apply text-soft-800 placeholder-soft-500;
}

:deep(.n-button--primary-type) {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

:deep(.n-button--primary-type:hover) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

:deep(.n-checkbox .n-checkbox-box) {
  @apply bg-white border-soft-300;
}

:deep(.n-checkbox .n-checkbox-box__border) {
  @apply border-soft-300;
}

:deep(.n-checkbox--checked .n-checkbox-box) {
  @apply bg-primary-500 border-primary-500;
}

:deep(.n-checkbox__label) {
  @apply text-soft-700;
}

:deep(.n-button--text-type.n-button--primary-type) {
  @apply text-primary-600;
}

:deep(.n-button--text-type.n-button--primary-type:hover) {
  @apply text-primary-700;
}
</style>