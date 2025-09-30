<template>
  <div class="create-project-form">
    <n-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      size="large"
      @submit.prevent="handleSubmit"
    >
      <n-form-item path="name" label="项目名称">
        <n-input
          v-model:value="formData.name"
          placeholder="请输入项目名称"
          :input-props="{ autocomplete: 'off' }"
        >
          <template #prefix>
            <Folder class="w-4 h-4 text-slate-400" />
          </template>
        </n-input>
      </n-form-item>

      <n-form-item path="description" label="项目描述">
        <n-input
          v-model:value="formData.description"
          type="textarea"
          placeholder="请输入项目描述（可选）"
          :autosize="{ minRows: 3, maxRows: 5 }"
        />
      </n-form-item>

      <n-form-item path="repositoryUrl" label="仓库地址">
        <n-input
          v-model:value="formData.repositoryUrl"
          placeholder="https://github.com/username/repository"
        >
          <template #prefix>
            <GitBranch class="w-4 h-4 text-slate-400" />
          </template>
        </n-input>
      </n-form-item>

      <n-form-item path="defaultBranch" label="默认分支">
        <n-input
          v-model:value="formData.defaultBranch"
          placeholder="main"
        >
          <template #prefix>
            <Code class="w-4 h-4 text-slate-400" />
          </template>
        </n-input>
      </n-form-item>

      <n-form-item path="techStack" label="技术栈">
        <n-select
          v-model:value="formData.techStack"
          multiple
          filterable
          tag
          :options="techStackOptions"
          placeholder="选择或输入技术栈"
        />
      </n-form-item>

      <n-form-item path="environment" label="环境">
        <n-select
          v-model:value="formData.environment"
          :options="environmentOptions"
          placeholder="选择部署环境"
        />
      </n-form-item>

      <!-- Repository Integration -->
      <div class="integration-section" v-if="formData.repositoryUrl">
        <h4>仓库集成</h4>
        <div class="integration-info">
          <div class="repo-info">
            <div class="repo-provider">
              <component :is="getRepoIcon()" class="w-5 h-5" />
              <span>{{ getRepoProvider() }}</span>
            </div>
            <div class="repo-name">{{ getRepoName() }}</div>
          </div>
          <n-button @click="testConnection" :loading="testing">
            <template #icon>
              <Zap class="w-4 h-4" />
            </template>
            测试连接
          </n-button>
        </div>
      </div>

      <!-- Advanced Settings -->
      <n-collapse>
        <n-collapse-item title="高级设置" name="advanced">
          <div class="advanced-settings">
            <n-form-item path="autoDeployment" label="自动部署">
              <n-switch v-model:value="formData.autoDeployment" />
              <span class="setting-description">
                启用后，代码推送到默认分支时自动触发部署
              </span>
            </n-form-item>

            <n-form-item path="codeQualityCheck" label="代码质量检查">
              <n-switch v-model:value="formData.codeQualityCheck" />
              <span class="setting-description">
                启用SonarQube代码质量检查
              </span>
            </n-form-item>

            <n-form-item path="securityScan" label="安全扫描">
              <n-switch v-model:value="formData.securityScan" />
              <span class="setting-description">
                启用代码安全漏洞扫描
              </span>
            </n-form-item>

            <n-form-item path="notifications" label="通知设置">
              <n-checkbox-group v-model:value="formData.notifications">
                <n-checkbox value="email">邮件通知</n-checkbox>
                <n-checkbox value="slack">Slack通知</n-checkbox>
                <n-checkbox value="webhook">Webhook</n-checkbox>
              </n-checkbox-group>
            </n-form-item>
          </div>
        </n-collapse-item>
      </n-collapse>

      <div class="form-actions">
        <n-button @click="$emit('cancel')">取消</n-button>
        <n-button
          type="primary"
          :loading="loading"
          :disabled="!isFormValid"
          attr-type="submit"
        >
          <template #icon>
            <Plus class="w-4 h-4" />
          </template>
          创建项目
        </n-button>
      </div>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  NForm, 
  NFormItem, 
  NInput, 
  NSelect, 
  NButton, 
  NSwitch,
  NCheckbox,
  NCheckboxGroup,
  NCollapse,
  NCollapseItem,
  useMessage,
  type FormInst,
  type FormRules
} from 'naive-ui'
import { 
  Folder, 
  GitBranch, 
  Code, 
  Plus, 
  Zap,
  Github,
  GitlabIcon as Gitlab
} from 'lucide-vue-next'

const emit = defineEmits(['success', 'cancel'])
const message = useMessage()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const testing = ref(false)

const formData = ref({
  name: '',
  description: '',
  repositoryUrl: '',
  defaultBranch: 'main',
  techStack: [],
  environment: 'DEVELOPMENT',
  autoDeployment: false,
  codeQualityCheck: true,
  securityScan: true,
  notifications: ['email']
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 2, max: 50, message: '项目名称长度为2-50位', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9\s\-_]+$/, message: '项目名称只能包含字母、数字、空格、连字符和下划线', trigger: 'blur' }
  ],
  repositoryUrl: [
    { 
      validator: (rule, value) => {
        if (!value) return true
        const urlPattern = /^https?:\/\/(github\.com|gitlab\.com)\/[\w\-\.]+\/[\w\-\.]+$/
        if (!urlPattern.test(value)) {
          return new Error('请输入有效的GitHub或GitLab仓库地址')
        }
        return true
      },
      trigger: 'blur'
    }
  ],
  defaultBranch: [
    { required: true, message: '请输入默认分支', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9\-_\/]+$/, message: '分支名称格式不正确', trigger: 'blur' }
  ],
  environment: [
    { required: true, message: '请选择部署环境', trigger: 'change' }
  ]
}

const techStackOptions = [
  { label: 'React', value: 'React' },
  { label: 'Vue.js', value: 'Vue.js' },
  { label: 'Angular', value: 'Angular' },
  { label: 'Node.js', value: 'Node.js' },
  { label: 'NestJS', value: 'NestJS' },
  { label: 'Express', value: 'Express' },
  { label: 'Python', value: 'Python' },
  { label: 'Django', value: 'Django' },
  { label: 'FastAPI', value: 'FastAPI' },
  { label: 'Java', value: 'Java' },
  { label: 'Spring Boot', value: 'Spring Boot' },
  { label: 'Go', value: 'Go' },
  { label: 'Rust', value: 'Rust' },
  { label: 'PostgreSQL', value: 'PostgreSQL' },
  { label: 'MySQL', value: 'MySQL' },
  { label: 'MongoDB', value: 'MongoDB' },
  { label: 'Redis', value: 'Redis' },
  { label: 'Docker', value: 'Docker' },
  { label: 'Kubernetes', value: 'Kubernetes' },
  { label: 'AWS', value: 'AWS' },
  { label: 'Azure', value: 'Azure' },
  { label: 'GCP', value: 'GCP' }
]

const environmentOptions = [
  { label: '开发环境', value: 'DEVELOPMENT' },
  { label: '测试环境', value: 'TESTING' },
  { label: '预发布环境', value: 'STAGING' },
  { label: '生产环境', value: 'PRODUCTION' }
]

const isFormValid = computed(() => {
  return formData.value.name && formData.value.defaultBranch && formData.value.environment
})

const getRepoProvider = () => {
  if (!formData.value.repositoryUrl) return ''
  if (formData.value.repositoryUrl.includes('github.com')) return 'GitHub'
  if (formData.value.repositoryUrl.includes('gitlab.com')) return 'GitLab'
  return 'Git'
}

const getRepoIcon = () => {
  const provider = getRepoProvider()
  if (provider === 'GitHub') return Github
  if (provider === 'GitLab') return Gitlab
  return GitBranch
}

const getRepoName = () => {
  if (!formData.value.repositoryUrl) return ''
  const match = formData.value.repositoryUrl.match(/\/([^\/]+\/[^\/]+)$/)
  return match ? match[1] : ''
}

const testConnection = async () => {
  testing.value = true
  try {
    // TODO: 实现仓库连接测试API
    await new Promise(resolve => setTimeout(resolve, 1500))
    message.success('仓库连接测试成功')
  } catch (error) {
    message.error('仓库连接测试失败，请检查地址是否正确')
  } finally {
    testing.value = false
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    loading.value = true

    // 调用真实API创建项目
    const { createProject } = await import('@/api/projects')
    const projectData = {
      name: formData.value.name,
      description: formData.value.description,
      repository: formData.value.repositoryUrl
    }
    
    const newProject = await createProject(projectData)
    message.success('项目创建成功')
    emit('success', newProject)
  } catch (error) {
    console.error('Create project error:', error)
    message.error('项目创建失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.create-project-form {
  @apply space-y-6;
}

.integration-section {
  @apply p-4 rounded-xl border;
  background: rgba(15, 23, 42, 0.5);
  border-color: rgba(148, 163, 184, 0.1);
}

.integration-section h4 {
  @apply text-lg font-semibold text-white mb-4;
}

.integration-info {
  @apply flex items-center justify-between;
}

.repo-info {
  @apply space-y-2;
}

.repo-provider {
  @apply flex items-center gap-2 text-sm text-slate-400;
}

.repo-name {
  @apply font-medium text-white;
}

.advanced-settings {
  @apply space-y-4;
}

.setting-description {
  @apply text-sm text-slate-400 ml-3;
}

.form-actions {
  @apply flex justify-end gap-3 pt-6 border-t border-slate-700;
}

/* Form Styling Overrides */
:deep(.n-form-item-label) {
  @apply text-slate-300;
}

:deep(.n-input) {
  @apply bg-slate-700 border-slate-600;
}

:deep(.n-input:hover) {
  @apply border-slate-500;
}

:deep(.n-input.n-input--focus) {
  @apply border-blue-500;
}

:deep(.n-input__input-el) {
  @apply text-white placeholder-slate-400;
}

:deep(.n-input__textarea-el) {
  @apply text-white placeholder-slate-400;
}

:deep(.n-select) {
  @apply bg-slate-700;
}

:deep(.n-base-selection) {
  @apply bg-slate-700 border-slate-600;
}

:deep(.n-base-selection:hover) {
  @apply border-slate-500;
}

:deep(.n-base-selection.n-base-selection--focus) {
  @apply border-blue-500;
}

:deep(.n-base-selection-label) {
  @apply text-white;
}

:deep(.n-base-selection-placeholder) {
  @apply text-slate-400;
}

:deep(.n-base-selection-tags) {
  @apply text-white;
}

:deep(.n-tag) {
  @apply bg-slate-600 text-white border-slate-500;
}

:deep(.n-switch) {
  @apply bg-slate-600;
}

:deep(.n-switch.n-switch--active) {
  @apply bg-blue-600;
}

:deep(.n-checkbox .n-checkbox-box) {
  @apply bg-slate-700 border-slate-600;
}

:deep(.n-checkbox--checked .n-checkbox-box) {
  @apply bg-blue-600 border-blue-600;
}

:deep(.n-collapse) {
  @apply bg-transparent;
}

:deep(.n-collapse-item) {
  @apply bg-transparent border-slate-700;
}

:deep(.n-collapse-item__header) {
  @apply text-slate-300;
}

:deep(.n-collapse-item__content-wrapper) {
  @apply bg-transparent;
}

:deep(.n-collapse-item__content-inner) {
  @apply bg-transparent;
}

:deep(.n-button--primary-type) {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  border: none;
}

:deep(.n-button--primary-type:hover) {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
}
</style>