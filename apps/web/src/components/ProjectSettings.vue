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
            v-model="settings.displayName"
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
          <Label for="project-logo">项目Logo</Label>
          <Input
            id="project-logo"
            :model-value="settings.logo || ''"
            @update:model-value="(value: string | number) => settings.logo = typeof value === 'string' ? (value || null) : null"
            placeholder="输入Logo URL"
          />
        </div>

        <div class="form-field">
          <Label for="project-visibility">项目可见性</Label>
          <Select 
            :model-value="settings.isPublic ? 'true' : 'false'"
            @update:model-value="(value: AcceptableValue) => settings.isPublic = value === 'true'"
          >
            <SelectTrigger>
              <SelectValue placeholder="选择项目可见性" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">私有</SelectItem>
              <SelectItem value="true">公开</SelectItem>
            </SelectContent>
          </Select>
          <p class="text-sm text-muted-foreground mt-1">
            公开项目对所有用户可见，私有项目仅对项目成员可见
          </p>
        </div>

        <div class="form-field">
          <Label for="gitlab-project-id">GitLab 项目 ID</Label>
          <Input
            id="gitlab-project-id"
            :model-value="settings.gitlabProjectId?.toString() || ''"
            @update:model-value="(value: string | number) => settings.gitlabProjectId = typeof value === 'string' ? (value ? parseInt(value) || null : null) : (typeof value === 'number' ? value : null)"
            type="number"
            placeholder="例如：123456"
          />
          <p class="text-sm text-muted-foreground mt-1">
            关联的 GitLab 项目 ID，用于自动化部署
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
                <AvatarImage :src="member.user?.image || ''" :alt="member.user?.name || ''" />
                <AvatarFallback>{{ member.user?.name?.charAt(0).toUpperCase() || 'U' }}</AvatarFallback>
              </Avatar>
              <div class="member-details">
                <p class="member-name">{{ member.user?.name || '未知用户' }}</p>
                <p class="member-email">{{ member.user?.email || '' }}</p>
              </div>
            </div>
            
            <div class="member-role">
              <Select 
                :model-value="member.role"
                @update:model-value="(value: AcceptableValue) => updateMemberRole(member.userId, value as 'owner' | 'admin' | 'member' | 'viewer')"
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

type Member = NonNullable<Awaited<ReturnType<typeof trpc.projects.getMembers.query>>>[0]

const props = defineProps<{
  projectId: number
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
  id: 0,
  name: '',
  displayName: '',
  description: null,
  logo: null,
  ownerId: 0,
  gitlabProjectId: null,
  repositoryUrl: null,
  defaultBranch: 'main',
  isActive: true,
  isPublic: false,
  deploySettings: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  owner: null,
  environmentsCount: 0,
  deploymentsCount: 0,
  membersCount: 0
})

const members = ref<Member[]>([])

const inviteForm = reactive({
  email: '',
  role: 'member' as 'admin' | 'member' | 'viewer'
})

const currentUserId = ref(authStore.user?.id)

// 加载项目设置
const loadProjectSettings = async () => {
  try {
    const project = await trpc.projects.getById.query({ id: props.projectId })
    if (project) {
      Object.assign(settings, {
        name: project.name,
        displayName: project.displayName || '',
        description: project.description || '',
        logo: project.logo || '',
        isPublic: project.isPublic,
        gitlabProjectId: project.gitlabProjectId,
        // 移除不存在的部署设置字段
        // autoDeployEnabled: project.autoDeployEnabled || false,
        // deployBranch: project.deployBranch || 'main',
        // buildCommand: project.buildCommand || 'npm run build',
        // startCommand: project.startCommand || 'npm start'
      })
    }
    
    // 加载项目成员
    const membersResult = await trpc.projects.getMembers.query({ projectId: props.projectId })
    if (membersResult) {
      members.value = membersResult
    }
  } catch (error: any) {
    console.error('删除项目失败:', error)
    
    // 使用模拟数据
    Object.assign(settings, {
      name: '示例项目',
      displayName: '示例项目显示名称',
      description: '这是一个示例项目',
      logo: '',
      isPublic: false,
      gitlabProjectId: null
    })
    
    members.value = [
      {
        id: 1,
        userId: 1,
        projectId: props.projectId,
        role: 'owner',
        joinedAt: new Date().toISOString(),
        user: {
          id: 1,
          name: '张三',
          email: 'zhangsan@example.com',
          image: null
        }
      },
      {
        id: 2,
        userId: 2,
        projectId: props.projectId,
        role: 'admin',
        joinedAt: new Date().toISOString(),
        user: {
          id: 2,
          name: '李四',
          email: 'lisi@example.com',
          image: null
        }
      },
      {
        id: 3,
        userId: 3,
        projectId: props.projectId,
        role: 'member',
        joinedAt: new Date().toISOString(),
        user: {
          id: 3,
          name: '王五',
          email: 'wangwu@example.com',
          image: null
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
    
    await trpc.projects.update.mutate({
      id: props.projectId,
      displayName: settings.displayName || undefined,
      description: settings.description || undefined,
      logo: settings.logo || undefined,
      isPublic: settings.isPublic,
      // gitlabProjectId: settings.gitlabProjectId  // 暂时移除，因为 update schema 中没有这个字段
    })
    
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
const updateMemberRole = async (memberId: number, role: 'owner' | 'admin' | 'member' | 'viewer') => {
  try {
    await trpc.projects.updateMemberRole.mutate({
      projectId: props.projectId,
      userId: memberId,
      role
    })
    
    // 更新本地数据
    const member = members.value.find(m => m.id === memberId)
    if (member) {
      member.role = role as Member['role']
    }
  } catch (error: any) {
    console.error('更新成员角色失败:', error)
  }
}

// 移除成员
const removeMember = async (memberId: number) => {
  const member = members.value.find(m => m.id === memberId)
  if (!member || !confirm(`确定要移除成员 "${member.user?.name}" 吗？`)) {
    return
  }
  
  try {
    await trpc.projects.removeMember.mutate({
      projectId: props.projectId,
      userId: memberId
    })
    
    // 从本地数据中移除
    members.value = members.value.filter(m => m.id !== memberId)
  } catch (error: any) {
    console.error('移除成员失败:', error)
  }
}

// 邀请成员
const inviteMember = async () => {
  try {
    inviting.value = true
    
    await trpc.projects.inviteMember.mutate({
      projectId: props.projectId,
      email: inviteForm.email,
      role: inviteForm.role
    })
    
    // 重置表单
    inviteForm.email = ''
    inviteForm.role = 'member'
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