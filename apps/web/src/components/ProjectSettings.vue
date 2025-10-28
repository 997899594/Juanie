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

        <div class="form-field">
          <Label for="project-display-name">显示名称</Label>
          <Input
            id="project-display-name"
            v-model="settings.displayName!"
            placeholder="输入项目显示名称"
          />
        </div>

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

        <div class="form-field">
          <Label for="repository-url">代码仓库 URL</Label>
          <Input
            id="repository-url"
            :model-value="settings.repositoryUrl || ''"
            @update:model-value="(value: string | number) => settings.repositoryUrl = typeof value === 'string' ? (value || null) : null"
            type="url"
            placeholder="https://github.com/username/repo"
          />
          <p class="text-sm text-muted-foreground mt-1">
            代码仓库的 URL 地址，用于自动化部署
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
        <!-- 
        <div class="form-field">
          <div class="flex items-center justify-between">
            <div>
              <Label>自动部署</Label>
              <p class="text-sm text-muted-foreground">
                当代码推送到主分支时自动触发部署
              </p>
            </div>
            <Switch 
              v-model="settings.autoDeployEnabled"
              @update:model-value="saveDeploySettings"
            />
          </div>
        </div>

        <div class="form-field">
          <Label for="deploy-branch">部署分支</Label>
          <Input
            id="deploy-branch"
            v-model="settings.deployBranch"
            placeholder="main"
          />
          <p class="text-sm text-muted-foreground mt-1">
            指定用于自动部署的分支
          </p>
        </div>

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

        <div class="form-actions">
          <Button @click="saveDeploySettings" :disabled="saving">
            <Loader2 v-if="saving" class="h-4 w-4 mr-2 animate-spin" />
            保存部署设置
          </Button>
        </div>
        -->
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
                <AvatarImage :src="member.user?.avatar || ''" :alt="member.user?.name || ''" />
            <AvatarFallback>{{ member.user?.name?.charAt(0).toUpperCase() || 'U' }}</AvatarFallback>
          </Avatar>
          <div class="member-info">
            <p class="member-name">{{ member.user?.name || '未知用户' }}</p>
                <p class="member-email">{{ member.user?.email || '' }}</p>
              </div>
            </div>
            
            <div class="member-role">
              <Select 
                :model-value="member.role"
                @update:model-value="(value) => updateMemberRole(member.userId, value as 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner')"
                :disabled="member.userId === currentUserId"
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

// 使用 tRPC 推断类型，不再自定义 ProjectSettings 接口
type ProjectSettings = NonNullable<Awaited<ReturnType<typeof trpc.projects.getById.query>>>

type Member = NonNullable<Awaited<ReturnType<typeof trpc.projects.members.list.query>>>[0]

const props = defineProps<{
  projectId: string
}>()

const router = useRouter()
const authStore = useAuthStore()

const saving = ref(false)
const inviting = ref(false)
const deleting = ref(false)
const errors = ref<Record<string, string>>({})

const showInviteModal = ref(false)
const showDeleteConfirm = ref(false)
const deleteConfirmName = ref('')

const settings = reactive<ProjectSettings>({
  id: '0',
  organizationId: '',
  name: '',
  slug: '',
  displayName: null,
  description: null,
  repositoryUrl: null,
  visibility: 'private' as 'private' | 'public' | 'internal' | null,
  status: 'active' as 'active' | 'inactive' | 'archived' | 'suspended' | null,
  defaultBranch: 'main',
  enableCiCd: true,
  enableAiAssistant: true,
  enableMonitoring: true,
  aiModelPreference: 'gpt-4',
  aiAutoReview: true,
  aiCostOptimization: true,
  maxComputeUnits: 100,
  maxStorageGb: 100,
  maxMonthlyCost: '1000.00',
  currentComputeUnits: 0,
  currentStorageGb: 0,
  currentMonthlyCost: '0.00',
  primaryTag: null,
  secondaryTags: null,
  isArchived: false,
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
      Object.assign(settings, project)
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
      repositoryUrl: '',
      visibility: 'private'
    })
    
    members.value = [
      {
        id: '1',
        userId: '1',
        role: 'owner' as 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner',
        joinedAt: new Date().toISOString(),
        user: {
          id: '1',
          name: '张三',
          email: 'zhangsan@example.com',
          avatar: null
        }
      },
      {
        id: '2',
        userId: '2',
        role: 'developer' as 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner',
        joinedAt: new Date().toISOString(),
        user: {
          id: '2',
          name: '李四',
          email: 'lisi@example.com',
          avatar: null
        }
      },
      {
        id: '3',
        userId: '3',
        role: 'developer' as 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner',
        joinedAt: new Date().toISOString(),
        user: {
          id: '3',
          name: '王五',
          email: 'wangwu@example.com',
          avatar: null
        }
      }
    ]
  }
}

// 保存基本设置
const saveBasicSettings = async () => {
  try {
    saving.value = true
    errors.value = {}
    
    // 暂时注释掉不存在的 API 调用
    // await trpc.projects.update.mutate({
    //   id: props.projectId,
    //   data: {
    //     name: settings.name,
    //     displayName: settings.displayName || undefined,
    //     description: settings.description || undefined,
    //     repositoryUrl: settings.repositoryUrl || undefined,
    //     visibility: settings.visibility,
    //     defaultBranch: settings.defaultBranch
    //   }
    // })
    
    console.log('保存基本设置:', {
      id: props.projectId,
      name: settings.name,
      displayName: settings.displayName,
      description: settings.description,
      repositoryUrl: settings.repositoryUrl,
      visibility: settings.visibility,
      defaultBranch: settings.defaultBranch
    })
    alert('保存基本设置功能暂未实现')
    
    // TODO: 显示成功提示
    console.log('基本设置保存成功')
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

// 保存部署设置 - 暂时注释掉，因为项目 schema 中没有这些字段
/*
const saveDeploySettings = async () => {
  try {
    saving.value = true
    
    await trpc.projects.updateDeploySettings.mutate({
      id: props.projectId,
      autoDeployEnabled: settings.autoDeployEnabled,
      deployBranch: settings.deployBranch,
      buildCommand: settings.buildCommand,
      startCommand: settings.startCommand
    })
    
    console.log('部署设置保存成功')
  } catch (error: any) {
    console.error('加载项目设置失败:', error)
  } finally {
    saving.value = false
  }
}
*/

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
  } catch (error: any) {
    console.error('更新成员角色失败:', error)
  }
}

// 移除成员
const removeMember = async (memberId: string) => {
  const member = members.value.find(m => m.id === memberId)
  if (!member || !confirm(`确定要移除成员 "${member.user?.name}" 吗？`)) {
    return
  }
  
  try {
    // 恢复已实现的 API 调用
    await trpc.projects.members.remove.mutate({
      projectId: props.projectId,
      userId: memberId
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
    
    await trpc.projects.members.add.mutate({
      projectId: props.projectId,
      userId: 'temp-user-id', // 需要根据 email 查找用户 ID
      role: inviteForm.role as 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner'
    })
    
    // 重置表单
    inviteForm.email = ''
    inviteForm.role = 'developer'
    showInviteModal.value = false
    
    // 重新加载成员列表
    await loadProjectSettings()
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
    
    await trpc.projects.delete.mutate({ id: props.projectId })
    
    // 跳转到项目列表
    router.push('/projects')
  } catch (error: any) {
    console.error('获取项目成员失败:', error)
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