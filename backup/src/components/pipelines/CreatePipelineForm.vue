<template>
  <div class="create-pipeline-form">
    <n-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="top"
      require-mark-placement="right-hanging"
      class="form-container"
    >
      <!-- 基本信息 -->
      <div class="form-section">
        <h3 class="section-title">基本信息</h3>
        <div class="form-grid">
          <n-form-item label="流水线名称" path="name">
            <n-input
              v-model:value="formData.name"
              placeholder="请输入流水线名称"
              clearable
            />
          </n-form-item>
          
          <n-form-item label="关联项目" path="projectId">
            <n-select
              v-model:value="formData.projectId"
              placeholder="选择关联项目"
              :options="projectOptions"
              clearable
            />
          </n-form-item>
        </div>
        
        <n-form-item label="描述" path="description">
          <n-input
            v-model:value="formData.description"
            type="textarea"
            placeholder="请输入流水线描述"
            :rows="3"
          />
        </n-form-item>
      </div>

      <!-- 代码仓库配置 -->
      <div class="form-section">
        <h3 class="section-title">
          <GitBranch :size="18" />
          代码仓库配置
        </h3>
        <div class="form-grid">
          <n-form-item label="仓库地址" path="repositoryUrl">
            <n-input
              v-model:value="formData.repositoryUrl"
              placeholder="https://github.com/username/repo.git"
              clearable
            >
              <template #prefix>
                <component :is="getRepoIcon()" :size="16" />
              </template>
            </n-input>
          </n-form-item>
          
          <n-form-item label="默认分支" path="defaultBranch">
            <n-input
              v-model:value="formData.defaultBranch"
              placeholder="main"
              clearable
            />
          </n-form-item>
        </div>
        
        <div class="form-grid">
          <n-form-item label="触发条件" path="triggers">
            <n-checkbox-group v-model:value="formData.triggers">
              <n-space>
                <n-checkbox value="push">代码推送</n-checkbox>
                <n-checkbox value="pr">Pull Request</n-checkbox>
                <n-checkbox value="schedule">定时触发</n-checkbox>
                <n-checkbox value="manual">手动触发</n-checkbox>
              </n-space>
            </n-checkbox-group>
          </n-form-item>
        </div>
        
        <n-form-item v-if="formData.triggers.includes('schedule')" label="定时配置" path="schedule">
          <n-input
            v-model:value="formData.schedule"
            placeholder="0 2 * * * (每天凌晨2点)"
            clearable
          >
            <template #suffix>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <HelpCircle :size="16" class="text-slate-400" />
                </template>
                使用 Cron 表达式格式
              </n-tooltip>
            </template>
          </n-input>
        </n-form-item>
      </div>

      <!-- 构建配置 -->
      <div class="form-section">
        <h3 class="section-title">
          <Settings :size="18" />
          构建配置
        </h3>
        <div class="form-grid">
          <n-form-item label="构建环境" path="buildEnvironment">
            <n-select
              v-model:value="formData.buildEnvironment"
              placeholder="选择构建环境"
              :options="buildEnvironmentOptions"
            />
          </n-form-item>
          
          <n-form-item label="Node.js版本" path="nodeVersion">
            <n-select
              v-model:value="formData.nodeVersion"
              placeholder="选择Node.js版本"
              :options="nodeVersionOptions"
            />
          </n-form-item>
        </div>
        
        <n-form-item label="构建命令" path="buildCommands">
          <n-dynamic-input
            v-model:value="formData.buildCommands"
            placeholder="npm install"
            :min="1"
          />
        </n-form-item>
        
        <n-form-item label="测试命令" path="testCommands">
          <n-dynamic-input
            v-model:value="formData.testCommands"
            placeholder="npm test"
          />
        </n-form-item>
      </div>

      <!-- 部署配置 -->
      <div class="form-section">
        <h3 class="section-title">
          <Rocket :size="18" />
          部署配置
        </h3>
        <div class="form-grid">
          <n-form-item label="部署环境" path="deployEnvironment">
            <n-select
              v-model:value="formData.deployEnvironment"
              placeholder="选择部署环境"
              :options="deployEnvironmentOptions"
              multiple
            />
          </n-form-item>
          
          <n-form-item label="部署策略" path="deployStrategy">
            <n-select
              v-model:value="formData.deployStrategy"
              placeholder="选择部署策略"
              :options="deployStrategyOptions"
            />
          </n-form-item>
        </div>
        
        <n-form-item label="部署命令" path="deployCommands">
          <n-dynamic-input
            v-model:value="formData.deployCommands"
            placeholder="npm run deploy"
          />
        </n-form-item>
      </div>

      <!-- 高级设置 -->
      <div class="form-section">
        <h3 class="section-title">
          <Sliders :size="18" />
          高级设置
        </h3>
        <div class="advanced-options">
          <n-checkbox v-model:checked="formData.enableCache">
            启用构建缓存
          </n-checkbox>
          <n-checkbox v-model:checked="formData.enableNotifications">
            启用通知
          </n-checkbox>
          <n-checkbox v-model:checked="formData.enableArtifacts">
            保存构建产物
          </n-checkbox>
          <n-checkbox v-model:checked="formData.enableParallel">
            并行执行
          </n-checkbox>
        </div>
        
        <div class="form-grid" v-if="formData.enableNotifications">
          <n-form-item label="通知方式" path="notificationMethods">
            <n-checkbox-group v-model:value="formData.notificationMethods">
              <n-space>
                <n-checkbox value="email">邮件</n-checkbox>
                <n-checkbox value="slack">Slack</n-checkbox>
                <n-checkbox value="webhook">Webhook</n-checkbox>
              </n-space>
            </n-checkbox-group>
          </n-form-item>
        </div>
        
        <div class="form-grid">
          <n-form-item label="超时时间(分钟)" path="timeout">
            <n-input-number
              v-model:value="formData.timeout"
              :min="1"
              :max="480"
              placeholder="30"
            />
          </n-form-item>
          
          <n-form-item label="最大重试次数" path="maxRetries">
            <n-input-number
              v-model:value="formData.maxRetries"
              :min="0"
              :max="5"
              placeholder="3"
            />
          </n-form-item>
        </div>
      </div>
    </n-form>

    <!-- 操作按钮 -->
    <div class="form-actions">
      <n-button @click="$emit('cancel')">
        取消
      </n-button>
      <n-button type="primary" @click="handleSubmit" :loading="submitting">
        创建流水线
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'
import {
  GitBranch, Settings, Rocket, Sliders, HelpCircle,
  Github, Gitlab
} from 'lucide-vue-next'

const emit = defineEmits(['success', 'cancel'])
const message = useMessage()

const formRef = ref()
const submitting = ref(false)

// 表单数据
const formData = ref({
  name: '',
  projectId: null,
  description: '',
  repositoryUrl: '',
  defaultBranch: 'main',
  triggers: ['push'],
  schedule: '',
  buildEnvironment: 'ubuntu-latest',
  nodeVersion: '18',
  buildCommands: ['npm install', 'npm run build'],
  testCommands: ['npm test'],
  deployEnvironment: [],
  deployStrategy: 'rolling',
  deployCommands: ['npm run deploy'],
  enableCache: true,
  enableNotifications: true,
  enableArtifacts: false,
  enableParallel: false,
  notificationMethods: ['email'],
  timeout: 30,
  maxRetries: 3
})

// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入流水线名称', trigger: 'blur' },
    { min: 2, max: 50, message: '名称长度应在2-50个字符之间', trigger: 'blur' }
  ],
  projectId: [
    { required: true, message: '请选择关联项目', trigger: 'change' }
  ],
  repositoryUrl: [
    { required: true, message: '请输入仓库地址', trigger: 'blur' },
    { 
      pattern: /^https?:\/\/.+\.git$/, 
      message: '请输入有效的Git仓库地址', 
      trigger: 'blur' 
    }
  ],
  defaultBranch: [
    { required: true, message: '请输入默认分支', trigger: 'blur' }
  ],
  triggers: [
    { 
      type: 'array', 
      min: 1, 
      message: '请至少选择一个触发条件', 
      trigger: 'change' 
    }
  ],
  buildEnvironment: [
    { required: true, message: '请选择构建环境', trigger: 'change' }
  ],
  nodeVersion: [
    { required: true, message: '请选择Node.js版本', trigger: 'change' }
  ],
  buildCommands: [
    { 
      type: 'array', 
      min: 1, 
      message: '请至少添加一个构建命令', 
      trigger: 'change' 
    }
  ]
}

// 选项数据
const projectOptions = [
  { label: 'Web应用', value: 'web-app' },
  { label: 'API服务', value: 'api-service' },
  { label: '移动应用', value: 'mobile-app' },
  { label: '数据平台', value: 'data-platform' }
]

const buildEnvironmentOptions = [
  { label: 'Ubuntu Latest', value: 'ubuntu-latest' },
  { label: 'Ubuntu 20.04', value: 'ubuntu-20.04' },
  { label: 'Windows Latest', value: 'windows-latest' },
  { label: 'macOS Latest', value: 'macos-latest' }
]

const nodeVersionOptions = [
  { label: 'Node.js 16', value: '16' },
  { label: 'Node.js 18', value: '18' },
  { label: 'Node.js 20', value: '20' },
  { label: 'Node.js Latest', value: 'latest' }
]

const deployEnvironmentOptions = [
  { label: '开发环境', value: 'development' },
  { label: '测试环境', value: 'testing' },
  { label: '预发布环境', value: 'staging' },
  { label: '生产环境', value: 'production' }
]

const deployStrategyOptions = [
  { label: '滚动部署', value: 'rolling' },
  { label: '蓝绿部署', value: 'blue-green' },
  { label: '金丝雀部署', value: 'canary' },
  { label: '重新创建', value: 'recreate' }
]

// 计算属性
const getRepoIcon = () => {
  if (formData.value.repositoryUrl.includes('github.com')) {
    return Github
  } else if (formData.value.repositoryUrl.includes('gitlab.com')) {
    return Gitlab
  }
  return GitBranch
}

// 方法
const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    submitting.value = true
    
    // 调用真实API创建流水线
    const { createPipeline } = await import('@/api/pipelines')
    const pipelineData = {
      name: formData.value.name,
      description: formData.value.description,
      projectId: formData.value.projectId
    }
    
    await createPipeline(pipelineData)
    message.success('流水线创建成功')
    emit('success')
  } catch (error) {
    console.error('创建流水线失败:', error)
    message.error('流水线创建失败，请重试')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.create-pipeline-form {
  @apply max-w-4xl mx-auto;
}

.form-container {
  @apply space-y-8;
}

.form-section {
  @apply space-y-4;
}

.section-title {
  @apply text-lg font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-700/50;
}

.form-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.advanced-options {
  @apply grid grid-cols-2 gap-4;
}

.form-actions {
  @apply flex justify-end gap-3 pt-6 border-t border-slate-700/50;
}
</style>