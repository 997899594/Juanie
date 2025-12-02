<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑组织' : '创建组织' }}</DialogTitle>
        <DialogDescription>
          {{ isEdit ? '更新组织信息' : '创建一个新的组织来管理团队和项目' }}
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="space-y-2">
          <Label for="name">组织名称</Label>
          <Input
            id="name"
            v-model="formData.name"
            placeholder="例如：我的公司"
            required
          />
        </div>

        <!-- Git 同步选项 (仅创建时显示) -->
        <div v-if="!isEdit" class="space-y-4 pt-4 border-t">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>Git 平台同步</Label>
              <p class="text-sm text-muted-foreground">
                自动在 Git 平台创建组织并同步成员权限
              </p>
            </div>
            <Switch
              v-model:checked="formData.gitSyncEnabled"
              @update:checked="handleGitSyncToggle"
            />
          </div>

          <!-- Git 平台选择 -->
          <div v-if="formData.gitSyncEnabled" class="space-y-4 pl-4 border-l-2">
            <div class="space-y-2">
              <Label for="gitProvider">Git 平台</Label>
              <Select v-model="formData.gitProvider">
                <SelectTrigger id="gitProvider">
                  <SelectValue placeholder="选择 Git 平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">
                    <div class="flex items-center">
                      <Github class="mr-2 h-4 w-4" />
                      GitHub
                    </div>
                  </SelectItem>
                  <SelectItem value="gitlab">
                    <div class="flex items-center">
                      <Gitlab class="mr-2 h-4 w-4" />
                      GitLab
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label for="gitOrgName">Git 组织名称</Label>
              <Input
                id="gitOrgName"
                v-model="formData.gitOrgName"
                placeholder="例如：my-company"
                :required="formData.gitSyncEnabled"
              />
              <p class="text-xs text-muted-foreground">
                将在 {{ formData.gitProvider === 'github' ? 'GitHub' : 'GitLab' }} 上创建此名称的组织
              </p>
            </div>

            <!-- 提示信息 -->
            <Alert>
              <Info class="h-4 w-4" />
              <AlertDescription>
                <strong>注意：</strong>
                <ul class="mt-2 space-y-1 text-sm">
                  <li>• 需要先关联 Git 账号才能启用同步</li>
                  <li>• 组织创建后将自动同步成员权限</li>
                  <li>• 可以在设置中随时修改同步配置</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="$emit('update:open', false)"
          >
            取消
          </Button>
          <Button type="submit" :disabled="loading">
            <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
            {{ isEdit ? '更新' : '创建' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
} from '@juanie/ui'
import { Loader2, Github, Gitlab, Info } from 'lucide-vue-next'

interface Organization {
  id: string
  name: string
  slug: string
  displayName: string | null
  gitProvider?: string | null
  gitOrgName?: string | null
  gitSyncEnabled?: boolean
}

interface Props {
  open: boolean
  loading?: boolean
  organization?: Organization | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  organization: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [data: {
    name: string
    slug: string
    displayName?: string
    gitSyncEnabled?: boolean
    gitProvider?: string
    gitOrgName?: string
  }]
}>()

const isEdit = ref(false)
const formData = ref({
  name: '',
  slug: '',
  gitSyncEnabled: false,
  gitProvider: 'github',
  gitOrgName: '',
})

// 监听 organization 变化，用于编辑模式
watch(
  () => props.organization,
  (org) => {
    if (org) {
      isEdit.value = true
      formData.value = {
        name: org.name,
        slug: org.slug,
        gitSyncEnabled: org.gitSyncEnabled || false,
        gitProvider: org.gitProvider || 'github',
        gitOrgName: org.gitOrgName || '',
      }
    } else {
      isEdit.value = false
      formData.value = {
        name: '',
        slug: '',
        gitSyncEnabled: false,
        gitProvider: 'github',
        gitOrgName: '',
      }
    }
  },
  { immediate: true }
)

// 监听 open 变化，关闭时重置表单
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen && !props.organization) {
      formData.value = {
        name: '',
        slug: '',
        gitSyncEnabled: false,
        gitProvider: 'github',
        gitOrgName: '',
      }
    }
  }
)

function handleGitSyncToggle(enabled: boolean) {
  if (enabled && !formData.value.gitOrgName) {
    // 自动填充 Git 组织名称
    formData.value.gitOrgName = formData.value.name.toLowerCase().replace(/\s+/g, '-')
  }
}

function handleSubmit() {
  const data: any = {
    name: formData.value.name,
    slug: formData.value.name.toLowerCase().replace(/\s+/g, '-'),
  }

  // 只在创建时包含 Git 同步信息
  if (!isEdit.value && formData.value.gitSyncEnabled) {
    data.gitSyncEnabled = true
    data.gitProvider = formData.value.gitProvider
    data.gitOrgName = formData.value.gitOrgName
  }

  emit('submit', data)
}
</script>
