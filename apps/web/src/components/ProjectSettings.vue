<template>
  <div class="project-settings">
    <!-- 基本设置 -->
    <Card class="settings-section">
      <CardHeader>
        <CardTitle>基本设置</CardTitle>
        <CardDescription>管理项目的基本信息</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="form-field">
          <Label for="project-name">项目名称</Label>
          <Input
            id="project-name"
            v-model="settings.name"
            :class="{ 'border-destructive': errors.name }"
          />
          <p v-if="errors.name" class="text-sm text-destructive mt-1">
            {{ errors.name }}
          </p>
        </div>

        <!-- displayName 字段不存在于 schema 中，使用 name 即可 -->

        <div class="form-field">
          <Label for="project-description">项目描述</Label>
          <Textarea
            id="project-description"
            :model-value="settings.description || ''"
            @update:model-value="(value: string | number) => settings.description = typeof value === 'string' ? (value || null) : null"
            rows="3"
          />
        </div>

        <div class="form-field">
          <Label for="project-visibility">项目可见性</Label>
            <Select 
              :model-value="settings.visibility || 'private'"
              @update:model-value="(value: AcceptableValue) => settings.visibility = value as 'public' | 'private' | 'internal'"
            >
              <SelectTrigger>
                <SelectValue placeholder="选择项目可见性" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">私有</SelectItem>
                <SelectItem value="public">公开</SelectItem>
                <SelectItem value="internal">内部</SelectItem>
              </SelectContent>
            </Select>
          <p class="text-sm text-muted-foreground mt-1">
            公开项目对所有用户可见，私有项目仅对项目成员可见
          </p>
        </div>

        <div class="form-actions">
          <Button @click="saveBasicSettings" :disabled="saving">
            <Loader2 v-if="saving" class="h-4 w-4 mr-2 animate-spin" />
            保存更改
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 部署设置 -->
    <Card class="settings-section">
      <CardHeader>
        <CardTitle>部署设置</CardTitle>
        <CardDescription>配置自动化部署相关设置</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- 部署设置暂时移除，因为项目 schema 中没有这些字段 -->
        
        <div class="form-field">
          <div class="flex items-center justify-between">
            <div>
              <Label>自动部署</Label>
              <p class="text-sm text-muted-foreground">
                当代码推送到主分支时自动触发部署
              </p>
            </div>
            <Switch 
              :model-value="settings.enableCiCd"
              @update:model-value="(value) => { settings.enableCiCd = value; saveDeploySettings(); }"
            />
          </div>
        </div>

        <div class="form-field">
          <Label for="deploy-branch">部署分支</Label>
          <Input
            id="deploy-branch"
            :model-value="settings.defaultBranch"
            @update:model-value="(value) => settings.defaultBranch = String(value)"
            placeholder="main"
          />
          <p class="text-sm text-muted-foreground mt-1">
            指定用于自动部署的分支
          </p>
        </div>

        <!-- 构建命令和启动命令暂时注释，等待后端schema支持
        <div class="form-field">
          <Label for="build-command">构建命令</Label>
          <Input
            id="build-command"
            v-model="settings.buildCommand"
            placeholder="npm run build"
          />
        </div>

        <div class="form-field">
          <Label for="start-command">启动命令</Label>
          <Input
            id="start-command"
            v-model="settings.startCommand"
            placeholder="npm start"
          />
        </div>
        -->

        <div class="form-actions">
          <Button @click="saveDeploySettings" :disabled="saving">
            <Loader2 v-if="saving" class="h-4 w-4 mr-2 animate-spin" />
            保存部署设置
          </Button>
        </div>
       
      </CardContent>
    </Card>

    <!-- 成员管理 -->
    <Card class="settings-section">
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle>成员管理</CardTitle>
            <CardDescription>管理项目成员和权限</CardDescription>
          </div>
          <Button @click="showInviteModal = true">
            <UserPlus class="h-4 w-4 mr-2" />
            邀请成员
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div class="members-list">
          <div 
            v-for="member in members" 
            :key="member.id"
            class="member-item"
          >
            <div class="member-info">
              <Avatar class="h-8 w-8">
                <AvatarImage :src="member.user?.avatarUrl || ''" :alt="member.user?.displayName || member.user?.username || ''" />
            <AvatarFallback>{{ (member.user?.displayName || member.user?.username || 'U').charAt(0).toUpperCase() }}</AvatarFallback>
          </Avatar>
          <div class="member-info">
            <p class="member-name">{{ member.user?.displayName || member.user?.username || '未知用户' }}</p>
                <p class="member-email">{{ member.user?.email || '' }}</p>
              </div>
            </div>
            
            <div class="member-role">
              <Select 
                :model-value="member.role"
                @update:model-value="(value) => updateMemberRole(member.user.id, value as 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner')"
                :disabled="member.user.id === currentUserId"
              >
                <SelectTrigger class="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">所有者</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="member">成员</SelectItem>
                  <SelectItem value="viewer">查看者</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div class="member-actions">
              <Button
                v-if="member.id !== currentUserId"
                variant="ghost"
                size="sm"
                @click="removeMember(member.id)"
                class="text-destructive hover:text-destructive"
              >
                <UserMinus class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 危险操作 -->
    <Card class="settings-section border-destructive">
      <CardHeader>
        <CardTitle class="text-destructive">危险操作</CardTitle>
        <CardDescription>这些操作不可撤销，请谨慎操作</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="danger-action">
          <div class="action-info">
            <h4 class="font-medium">删除项目</h4>
            <p class="text-sm text-muted-foreground">
              永久删除此项目及其所有数据，包括环境、部署记录等
            </p>
          </div>
          <Button 
            variant="destructive" 
            @click="showDeleteConfirm = true"
          >
            删除项目
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 邀请成员模态框 -->
    <Dialog :open="showInviteModal" @update:open="showInviteModal = false">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>邀请成员</DialogTitle>
          <DialogDescription>
            邀请新成员加入项目
          </DialogDescription>
        </DialogHeader>
        
        <form @submit.prevent="inviteMember" class="space-y-4">
          <div class="form-field">
            <Label for="invite-email">邮箱地址</Label>
            <Input
              id="invite-email"
              v-model="inviteForm.email"
              type="email"
              placeholder="user@example.com"
              required
            />
          </div>
          
          <div class="form-field">
            <Label for="invite-role">角色</Label>
            <Select v-model="inviteForm.role">
              <SelectTrigger>
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">管理员</SelectItem>
                <SelectItem value="developer">开发者</SelectItem>
                <SelectItem value="viewer">查看者</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              @click="showInviteModal = false"
            >
              取消
            </Button>
            <Button type="submit" :disabled="inviting">
              <Loader2 v-if="inviting" class="h-4 w-4 mr-2 animate-spin" />
              发送邀请
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- 删除确认模态框 -->
    <Dialog :open="showDeleteConfirm" @update:open="showDeleteConfirm = false">
      <DialogContent>
        <DialogHeader>
          <DialogTitle class="text-destructive">确认删除项目</DialogTitle>
          <DialogDescription>
            此操作将永久删除项目 "{{ settings.name }}" 及其所有数据，包括：
          </DialogDescription>
        </DialogHeader>
        
        <div class="delete-warning">
          <ul class="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>所有环境配置</li>
            <li>部署历史记录</li>
            <li>项目成员关系</li>
            <li>相关日志文件</li>
          </ul>
          
          <div class="mt-4">
            <Label for="delete-confirm">请输入项目名称以确认删除：</Label>
            <Input
              id="delete-confirm"
              v-model="deleteConfirmName"
              :placeholder="settings.name"
              class="mt-2"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="showDeleteConfirm = false"
          >
            取消
          </Button>
          <Button 
            variant="destructive"
            :disabled="deleteConfirmName !== settings.name || deleting"
            @click="deleteProject"
          >
            <Loader2 v-if="deleting" class="h-4 w-4 mr-2 animate-spin" />
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@juanie/ui'
import type { AcceptableValue } from 'reka-ui'
import { UserPlus, UserMinus, Loader2 } from 'lucide-vue-next'
import { trpc, type AppRouter } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

// 项目成员类型基于后端实际实现的members.list API
type Member = Awaited<ReturnType<typeof trpc.projects.members.list.query>>[0]

// 本地设置状态类型（包含从 API 提取和本地管理的字段）
interface LocalProjectSettings {
  id: string
  organizationId: string
  name: string
  slug: string
  description: string | null
  visibility: 'private' | 'public' | 'internal'
  status: 'active' | 'inactive' | 'archived' | 'suspended'
  // 从 config 中提取的字段
  defaultBranch: string
  enableCiCd: boolean
  enableAiAssistant: boolean
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  projectId: string
}>()

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const saving = ref(false)
const inviting = ref(false)
const deleting = ref(false)
const errors = ref<Record<string, string>>({})

const showInviteModal = ref(false)
const showDeleteConfirm = ref(false)
const deleteConfirmName = ref('')

const settings = reactive<LocalProjectSettings>({
  id: '0',
  organizationId: '',
  name: '',
  slug: '',
  description: null,
  visibility: 'private',
  status: 'active',
  defaultBranch: 'main',
  enableCiCd: true,
  enableAiAssistant: true,
  createdAt: '',
  updatedAt: ''
})

const members = ref<Member[]>([])

const inviteForm = reactive({
  email: '',
  role: 'developer' as 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner'
})

const currentUserId = ref(authStore.user?.id)

// 加载项目设置
const loadProjectSettings = async () => {
  try {
    const project = await trpc.projects.getById.query({ id: props.projectId })
    if (project) {
      // 正确映射 project 字段到 settings
      settings.id = project.id
      settings.organizationId = project.organizationId
      settings.name = project.name
      settings.slug = project.slug
      settings.description = project.description
      settings.visibility = project.visibility as 'private' | 'public' | 'internal'
      settings.status = project.status as 'active' | 'inactive' | 'archived' | 'suspended'
      
      // 从 config 中提取字段
      if (project.config) {
        settings.defaultBranch = project.config.defaultBranch || 'main'
        settings.enableCiCd = project.config.enableCiCd ?? true
        settings.enableAiAssistant = project.config.enableAi ?? true
      }
      
      settings.createdAt = project.createdAt
      settings.updatedAt = project.updatedAt
    }
    
    // 加载项目成员
    const membersResult = await trpc.projects.members.list.query({ projectId: props.projectId })
    if (membersResult) {
      members.value = membersResult
    }
  } catch (error: any) {
    console.error('加载项目设置失败:', error)
    
    // 使用模拟数据作为后备
    Object.assign(settings, {
      name: '示例项目',
      displayName: '示例项目显示名称',
      description: '这是一个示例项目',
      visibility: 'private'
    })
    
    // 不使用 mock 数据，保持空状态
    members.value = []
  }
}

// 保存基本设置
const saveBasicSettings = async () => {
  try {
    saving.value = true
    errors.value = {}
    
    await trpc.projects.update.mutate({
      projectId: props.projectId,
      name: settings.name,
      slug: settings.slug,
      description: settings.description || undefined,
      visibility: settings.visibility as 'public' | 'private' | 'internal',
    })
    
    toast.success('保存成功', '项目基本设置已更新')
    await loadProjectSettings()
  } catch (error: any) {
    console.error('保存基本设置失败:', error)
    
    if (error?.data?.zodError) {
      const zodErrors = error.data.zodError.fieldErrors
      Object.keys(zodErrors).forEach(field => {
        errors.value[field] = zodErrors[field][0]
      })
    }
  } finally {
    saving.value = false
  }
}

// 保存部署设置 - 使用后端已实现的updateDeploySettings API
const saveDeploySettings = async () => {
  try {
    saving.value = true
    
    // 更新项目配置
    await trpc.projects.update.mutate({
      projectId: props.projectId,
      config: {
        defaultBranch: settings.defaultBranch || 'main',
        enableCiCd: settings.enableCiCd ?? true,
        enableAi: settings.enableAiAssistant ?? true,
      }
    })
    
    toast.success('保存成功', '部署设置已更新')
    await loadProjectSettings()
  } catch (error: any) {
    console.error('保存部署设置失败:', error)
    
    if (error?.data?.zodError) {
      const zodErrors = error.data.zodError.fieldErrors
      Object.keys(zodErrors).forEach(field => {
        errors.value[field] = zodErrors[field][0]
      })
    }
  } finally {
    saving.value = false
  }
}

// 更新成员角色
const updateMemberRole = async (memberId: string, role: 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner') => {
  try {
    // 暂时注释掉不存在的 API 调用
    // await trpc.projects.members.updateRole.mutate({
    //   projectId: props.projectId,
    //   userId: memberId,
    //   role
    // })
    
    console.log('更新成员角色:', { projectId: props.projectId, memberId, role })
    alert('更新成员角色功能暂未实现')
    
    // 更新本地数据
    const member = members.value.find((m: Member) => m.id === memberId)
    if (member) {
      member.role = role
    }
  } catch (error: any) {
    console.error('更新成员角色失败:', error)
  }
}

// 移除成员
const removeMember = async (memberId: string) => {
  const member = members.value.find((m: any) => m.id === memberId)
  const memberName = member?.user?.displayName || member?.user?.username || '该成员'
  if (!member || !confirm(`确定要移除成员 "${memberName}" 吗？`)) {
    return
  }
  
  try {
    // 使用正确的 API 参数
    await trpc.projects.members.remove.mutate({
      projectId: props.projectId,
      memberId: memberId
    })
    
    // 从本地数据中移除
    members.value = members.value.filter((m: Member) => m.id !== memberId)
  } catch (error: any) {
    console.error('移除成员失败:', error)
  }
}

// 邀请成员
const inviteMember = async () => {
  try {
    inviting.value = true
    
    // 映射前端角色到 API 角色
    const roleMap: Record<string, 'admin' | 'developer' | 'viewer'> = {
      'owner': 'admin',
      'maintainer': 'admin',
      'developer': 'developer',
      'reporter': 'viewer',
      'guest': 'viewer'
    }
    
    // TODO: 需要先根据 email 查找或创建用户
    // 目前暂时跳过，因为需要实现用户查找 API
    toast.error('邀请功能暂未完成', '需要先实现根据邮箱查找用户的功能')
    
    // 重置表单
    inviteForm.email = ''
    inviteForm.role = 'developer'
    showInviteModal.value = false
  } catch (error: any) {
    console.error('邀请成员失败:', error)
  } finally {
    inviting.value = false
  }
}

// 删除项目
const deleteProject = async () => {
  try {
    deleting.value = true
    
    // 恢复已实现的 API 调用
    await trpc.projects.delete.mutate({ projectId: props.projectId, repositoryAction: 'keep' })
    
    // 跳转到项目列表
    router.push('/projects')
  } catch (error: any) {
    console.error('删除项目失败:', error)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadProjectSettings()
})
</script>

<style scoped>
/* 移除所有@apply，使用UI库的原生类名和组件 */
</style>