<template>
  <div class="users-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">用户权限管理</h1>
          <p class="page-subtitle">管理用户账户、角色权限和团队组织</p>
        </div>
        <div class="header-actions">
          <n-button @click="refreshData" :loading="loading" circle>
            <template #icon>
              <RefreshCw :size="16" />
            </template>
          </n-button>
          <n-button @click="showInviteModal = true">
            <template #icon>
              <UserPlus :size="16" />
            </template>
            邀请用户
          </n-button>
          <n-button type="primary" @click="showUserModal = true">
            <template #icon>
              <Plus :size="16" />
            </template>
            添加用户
          </n-button>
        </div>
      </div>
    </div>

    <!-- 统计概览 -->
    <div class="stats-overview">
      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-icon">
            <Users :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ totalUsers }}</div>
            <div class="stat-label">总用户数</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon active">
            <UserCheck :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ activeUsers }}</div>
            <div class="stat-label">活跃用户</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon roles">
            <Shield :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ totalRoles }}</div>
            <div class="stat-label">角色数量</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon teams">
            <Building :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ totalTeams }}</div>
            <div class="stat-label">团队数量</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧：用户列表 -->
      <div class="users-section">
        <div class="section-header">
          <h3 class="section-title">用户列表</h3>
          <div class="section-actions">
            <n-input
              v-model:value="searchQuery"
              placeholder="搜索用户..."
              clearable
              size="small"
              style="width: 200px"
            >
              <template #prefix>
                <Search :size="16" />
              </template>
            </n-input>
            <n-select
              v-model:value="roleFilter"
              :options="roleFilterOptions"
              placeholder="筛选角色"
              clearable
              size="small"
              style="width: 120px"
            />
            <n-select
              v-model:value="statusFilter"
              :options="statusFilterOptions"
              placeholder="筛选状态"
              clearable
              size="small"
              style="width: 120px"
            />
          </div>
        </div>
        
        <div class="users-list">
          <div
            v-for="user in filteredUsers"
            :key="user.id"
            class="user-card"
            :class="{ active: selectedUser?.id === user.id }"
            @click="selectUser(user)"
          >
            <div class="user-avatar">
              <img v-if="user.avatar" :src="user.avatar" :alt="user.fullName" />
              <div v-else class="avatar-placeholder">
                {{ getInitials(user.fullName) }}
              </div>
            </div>
            <div class="user-info">
              <h4 class="user-name">{{ user.fullName }}</h4>
              <p class="user-email">{{ user.email }}</p>
              <div class="user-meta">
                <n-tag
                  :type="getRoleTagType(user.role)"
                  size="small"
                  :bordered="false"
                >
                  {{ getRoleDisplayName(user.role) }}
                </n-tag>
                <n-tag
                  :type="getStatusTagType(user.status)"
                  size="small"
                  :bordered="false"
                >
                  {{ getStatusDisplayName(user.status) }}
                </n-tag>
              </div>
            </div>
            <div class="user-actions">
              <n-dropdown
                :options="getUserActions(user)"
                @select="handleUserAction"
              >
                <n-button size="small" circle>
                  <template #icon>
                    <MoreVertical :size="14" />
                  </template>
                </n-button>
              </n-dropdown>
            </div>
          </div>
        </div>
        
        <!-- 分页 -->
        <div class="pagination-wrapper">
          <n-pagination
            v-model:page="currentPage"
            :page-count="totalPages"
            size="small"
            show-size-picker
            :page-sizes="[10, 20, 50]"
            :page-size="pageSize"
            @update:page-size="handlePageSizeChange"
          />
        </div>
      </div>

      <!-- 右侧：用户详情 -->
      <div class="user-detail">
        <div v-if="selectedUser" class="detail-content">
          <!-- 用户基本信息 -->
          <div class="detail-section">
            <div class="section-header">
              <h4 class="section-title">基本信息</h4>
              <n-button size="small" @click="editUser(selectedUser)">
                <template #icon>
                  <Edit :size="14" />
                </template>
                编辑
              </n-button>
            </div>
            <div class="user-profile">
              <div class="profile-avatar">
                <img v-if="selectedUser.avatar" :src="selectedUser.avatar" :alt="selectedUser.fullName" />
                <div v-else class="avatar-placeholder large">
                  {{ getInitials(selectedUser.fullName) }}
                </div>
              </div>
              <div class="profile-info">
                <h3 class="profile-name">{{ selectedUser.fullName }}</h3>
                <p class="profile-email">{{ selectedUser.email }}</p>
                <div class="profile-meta">
                  <div class="meta-item">
                    <span class="meta-label">角色:</span>
                    <n-tag :type="getRoleTagType(selectedUser.role)" size="small">
                      {{ getRoleDisplayName(selectedUser.role) }}
                    </n-tag>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">状态:</span>
                    <n-tag :type="getStatusTagType(selectedUser.status)" size="small">
                      {{ getStatusDisplayName(selectedUser.status) }}
                    </n-tag>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">加入时间:</span>
                    <span class="meta-value">{{ formatDate(selectedUser.createdAt) }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">最后登录:</span>
                    <span class="meta-value">{{ formatDate(selectedUser.lastLoginAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 权限管理 -->
          <div class="detail-section">
            <div class="section-header">
              <h4 class="section-title">权限管理</h4>
              <n-button size="small" @click="editPermissions(selectedUser)">
                <template #icon>
                  <Key :size="14" />
                </template>
                配置权限
              </n-button>
            </div>
            <div class="permissions-grid">
              <div
                v-for="permission in selectedUser.permissions"
                :key="permission.module"
                class="permission-item"
              >
                <div class="permission-header">
                  <component :is="getPermissionIcon(permission.module)" :size="20" />
                  <span class="permission-name">{{ permission.name }}</span>
                </div>
                <div class="permission-actions">
                  <n-tag
                    v-for="action in permission.actions"
                    :key="action"
                    :type="getPermissionActionType(action)"
                    size="small"
                    :bordered="false"
                  >
                    {{ getPermissionActionName(action) }}
                  </n-tag>
                </div>
              </div>
            </div>
          </div>

          <!-- 团队信息 -->
          <div class="detail-section">
            <div class="section-header">
              <h4 class="section-title">团队信息</h4>
              <n-button size="small" @click="manageTeams(selectedUser)">
                <template #icon>
                  <Users :size="14" />
                </template>
                管理团队
              </n-button>
            </div>
            <div class="teams-list">
              <div
                v-for="team in selectedUser.teams"
                :key="team.id"
                class="team-item"
              >
                <div class="team-info">
                  <h5 class="team-name">{{ team.name }}</h5>
                  <p class="team-description">{{ team.description }}</p>
                </div>
                <div class="team-role">
                  <n-tag :type="getTeamRoleType(team.role)" size="small">
                    {{ team.role }}
                  </n-tag>
                </div>
              </div>
            </div>
          </div>

          <!-- 活动日志 -->
          <div class="detail-section">
            <div class="section-header">
              <h4 class="section-title">活动日志</h4>
              <n-button size="small" @click="viewFullLogs(selectedUser)">
                查看全部
              </n-button>
            </div>
            <div class="activity-logs">
              <div
                v-for="log in selectedUser.activityLogs"
                :key="log.id"
                class="log-item"
              >
                <div class="log-time">{{ formatTime(log.timestamp) }}</div>
                <div class="log-content">
                  <div class="log-action">{{ log.action }}</div>
                  <div class="log-details">{{ log.details }}</div>
                </div>
                <div class="log-ip">{{ log.ipAddress }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-else class="empty-detail">
          <div class="empty-icon">
            <UserX :size="48" />
          </div>
          <h3>选择用户</h3>
          <p>请从左侧列表中选择一个用户查看详细信息</p>
        </div>
      </div>
    </div>

    <!-- 添加/编辑用户模态框 -->
    <n-modal v-model:show="showUserModal" preset="card" title="添加用户" class="user-modal">
      <div class="user-form">
        <n-form :model="userForm" label-placement="top">
          <div class="form-row">
            <n-form-item label="姓名" class="form-item">
              <n-input v-model:value="userForm.fullName" placeholder="输入用户姓名" />
            </n-form-item>
            <n-form-item label="邮箱" class="form-item">
              <n-input v-model:value="userForm.email" placeholder="输入邮箱地址" />
            </n-form-item>
          </div>
          <div class="form-row">
            <n-form-item label="角色" class="form-item">
              <n-select
                v-model:value="userForm.role"
                :options="roleOptions"
                placeholder="选择用户角色"
              />
            </n-form-item>
            <n-form-item label="状态" class="form-item">
              <n-select
                v-model:value="userForm.status"
                :options="statusOptions"
                placeholder="选择用户状态"
              />
            </n-form-item>
          </div>
          <n-form-item label="团队">
            <n-select
              v-model:value="userForm.teams"
              :options="teamOptions"
              placeholder="选择所属团队"
              multiple
            />
          </n-form-item>
          <n-form-item label="权限">
            <div class="permissions-config">
              <div
                v-for="module in availableModules"
                :key="module.key"
                class="module-permissions"
              >
                <div class="module-header">
                  <n-checkbox
                    :checked="isModuleSelected(module.key)"
                    @update:checked="toggleModule(module.key, $event)"
                  >
                    {{ module.name }}
                  </n-checkbox>
                </div>
                <div class="module-actions">
                  <n-checkbox-group
                    :value="getModuleActions(module.key)"
                    @update:value="updateModuleActions(module.key, $event)"
                  >
                    <n-checkbox
                      v-for="action in module.actions"
                      :key="action.key"
                      :value="action.key"
                      :disabled="!isModuleSelected(module.key)"
                    >
                      {{ action.name }}
                    </n-checkbox>
                  </n-checkbox-group>
                </div>
              </div>
            </div>
          </n-form-item>
        </n-form>
        <div class="modal-actions">
          <n-button @click="showUserModal = false">取消</n-button>
          <n-button type="primary" @click="saveUser">保存</n-button>
        </div>
      </div>
    </n-modal>

    <!-- 邀请用户模态框 -->
    <n-modal v-model:show="showInviteModal" preset="card" title="邀请用户" class="invite-modal">
      <div class="invite-form">
        <n-form :model="inviteForm" label-placement="top">
          <n-form-item label="邮箱地址">
            <n-dynamic-input
              v-model:value="inviteForm.emails"
              placeholder="输入邮箱地址"
              :min="1"
            />
          </n-form-item>
          <n-form-item label="默认角色">
            <n-select
              v-model:value="inviteForm.role"
              :options="roleOptions"
              placeholder="选择默认角色"
            />
          </n-form-item>
          <n-form-item label="邀请消息">
            <n-input
              v-model:value="inviteForm.message"
              type="textarea"
              placeholder="输入邀请消息（可选）"
              :rows="3"
            />
          </n-form-item>
        </n-form>
        <div class="modal-actions">
          <n-button @click="showInviteModal = false">取消</n-button>
          <n-button type="primary" @click="sendInvites">发送邀请</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import {
  Plus, RefreshCw, Search, Users, UserCheck, Shield, Building,
  UserPlus, UserX, MoreVertical, Edit, Trash2, Key, UserMinus,
  Code, GitBranch, Monitor, Database, Server, Lock
} from 'lucide-vue-next'
import { getUsers } from '@/api/users'

const message = useMessage()

// 响应式数据
const loading = ref(false)
const searchQuery = ref('')
const roleFilter = ref(null)
const statusFilter = ref(null)
const selectedUser = ref(null)
const showUserModal = ref(false)
const showInviteModal = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)

// 用户列表 - 替换为空数组，将从API获取
const users = ref([])

const userForm = ref({
  fullName: '',
  email: '',
  role: 'LEARNER',
  status: 'active',
  teams: [],
  permissions: {}
})

// 邀请表单
const inviteForm = ref({
  emails: [''],
  role: 'LEARNER',
  message: ''
})

// 选项数据
const roleFilterOptions = [
  { label: '管理员', value: 'ADMIN' },
  { label: 'DevOps工程师', value: 'MENTOR' },
  { label: '开发者', value: 'LEARNER' }
]

const statusFilterOptions = [
  { label: '活跃', value: 'active' },
  { label: '非活跃', value: 'inactive' },
  { label: '已禁用', value: 'disabled' }
]

const roleOptions = [
  { label: '管理员', value: 'ADMIN' },
  { label: 'DevOps工程师', value: 'MENTOR' },
  { label: '开发者', value: 'LEARNER' }
]

const statusOptions = [
  { label: '活跃', value: 'active' },
  { label: '非活跃', value: 'inactive' },
  { label: '已禁用', value: 'disabled' }
]

const teamOptions = [
  { label: '开发团队', value: '1' },
  { label: '运维团队', value: '2' },
  { label: '测试团队', value: '3' },
  { label: '产品团队', value: '4' }
]

const availableModules = [
  {
    key: 'projects',
    name: '项目管理',
    actions: [
      { key: 'read', name: '查看' },
      { key: 'write', name: '编辑' },
      { key: 'delete', name: '删除' }
    ]
  },
  {
    key: 'users',
    name: '用户管理',
    actions: [
      { key: 'read', name: '查看' },
      { key: 'write', name: '编辑' },
      { key: 'invite', name: '邀请' }
    ]
  },
  {
    key: 'pipelines',
    name: '流水线',
    actions: [
      { key: 'read', name: '查看' },
      { key: 'write', name: '编辑' },
      { key: 'execute', name: '执行' }
    ]
  },
  {
    key: 'monitoring',
    name: '监控',
    actions: [
      { key: 'read', name: '查看' },
      { key: 'configure', name: '配置' }
    ]
  }
]

// 计算属性
const totalUsers = computed(() => users.value.length)
const activeUsers = computed(() => users.value.filter(u => u.status === 'active').length)
const totalRoles = computed(() => 3) // 管理员、开发者、查看者
const totalTeams = computed(() => 4)

const filteredUsers = computed(() => {
  let filtered = users.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user =>
      user.fullName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    )
  }

  if (roleFilter.value) {
    filtered = filtered.filter(user => user.role === roleFilter.value)
  }

  if (statusFilter.value) {
    filtered = filtered.filter(user => user.status === statusFilter.value)
  }

  return filtered
})

const totalPages = computed(() => Math.ceil(filteredUsers.value.length / pageSize.value))

// 方法
const refreshData = async () => {
  loading.value = true
  try {
    const response = await getUsers()
    users.value = response.data || []
    message.success('数据已刷新')
  } catch (error) {
    console.error('获取用户列表失败:', error)
    message.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const selectUser = (user: any) => {
  selectedUser.value = user
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}

const getRoleTagType = (role: string) => {
  const types = {
    ADMIN: 'error',
    MENTOR: 'warning',
    LEARNER: 'info',
    admin: 'error',
    developer: 'info',
    viewer: 'default'
  }
  return types[role] || 'default'
}

const getRoleDisplayName = (role: string) => {
  const names = {
    ADMIN: '管理员',
    MENTOR: 'DevOps工程师',
    LEARNER: '开发者',
    admin: '管理员',
    developer: '开发者',
    viewer: '查看者'
  }
  return names[role] || role
}

const getStatusTagType = (status: string) => {
  const types = {
    active: 'success',
    inactive: 'warning',
    disabled: 'error'
  }
  return types[status] || 'default'
}

const getStatusDisplayName = (status: string) => {
  const names = {
    active: '活跃',
    inactive: '非活跃',
    disabled: '已禁用'
  }
  return names[status] || status
}

const getPermissionIcon = (module: string) => {
  const icons = {
    projects: Code,
    users: Users,
    pipelines: GitBranch,
    monitoring: Monitor,
    database: Database,
    security: Lock
  }
  return icons[module] || Server
}

const getPermissionActionType = (action: string) => {
  const types = {
    read: 'info',
    write: 'warning',
    delete: 'error',
    execute: 'success'
  }
  return types[action] || 'default'
}

const getPermissionActionName = (action: string) => {
  const names = {
    read: '查看',
    write: '编辑',
    delete: '删除',
    execute: '执行',
    configure: '配置',
    invite: '邀请'
  }
  return names[action] || action
}

const getTeamRoleType = (role: string) => {
  if (role.includes('负责人')) return 'error'
  if (role.includes('高级')) return 'warning'
  return 'info'
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('zh-CN')
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

const getUserActions = (user: any) => {
  return [
    {
      label: '编辑用户',
      key: 'edit',
      props: { user }
    },
    {
      label: '重置密码',
      key: 'reset-password',
      props: { user }
    },
    {
      label: user.status === 'active' ? '禁用用户' : '启用用户',
      key: 'toggle-status',
      props: { user }
    },
    {
      label: '删除用户',
      key: 'delete',
      props: { user }
    }
  ]
}

const handleUserAction = (key: string, option: any) => {
  const user = option.props.user
  switch (key) {
    case 'edit':
      editUser(user)
      break
    case 'reset-password':
      resetPassword(user)
      break
    case 'toggle-status':
      toggleUserStatus(user)
      break
    case 'delete':
      deleteUser(user)
      break
  }
}

const editUser = (user: any) => {
  userForm.value = {
    ...user,
    teams: user.teams.map(t => t.id)
  }
  showUserModal.value = true
}

const resetPassword = (user: any) => {
  message.info(`重置 ${user.fullName} 的密码`)
}

const toggleUserStatus = (user: any) => {
  const newStatus = user.status === 'active' ? 'inactive' : 'active'
  user.status = newStatus
  message.success(`用户状态已更新为${getStatusDisplayName(newStatus)}`)
}

const deleteUser = (user: any) => {
  const index = users.value.findIndex(u => u.id === user.id)
  if (index > -1) {
    users.value.splice(index, 1)
    if (selectedUser.value?.id === user.id) {
      selectedUser.value = null
    }
    message.success(`已删除用户 ${user.fullName}`)
  }
}

const editPermissions = (user: any) => {
  message.info(`配置 ${user.fullName} 的权限`)
}

const manageTeams = (user: any) => {
  message.info(`管理 ${user.fullName} 的团队`)
}

const viewFullLogs = (user: any) => {
  message.info(`查看 ${user.fullName} 的完整日志`)
}

const handlePageSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
}

const isModuleSelected = (moduleKey: string) => {
  return userForm.value.permissions[moduleKey] && userForm.value.permissions[moduleKey].length > 0
}

const toggleModule = (moduleKey: string, checked: boolean) => {
  if (checked) {
    userForm.value.permissions[moduleKey] = ['read']
  } else {
    delete userForm.value.permissions[moduleKey]
  }
}

const getModuleActions = (moduleKey: string) => {
  return userForm.value.permissions[moduleKey] || []
}

const updateModuleActions = (moduleKey: string, actions: string[]) => {
  if (actions.length > 0) {
    userForm.value.permissions[moduleKey] = actions
  } else {
    delete userForm.value.permissions[moduleKey]
  }
}

const saveUser = () => {
  if (!userForm.value.fullName || !userForm.value.email) {
    message.error('请填写必填字段')
    return
  }

  // 模拟保存用户
  const newUser = {
    id: Date.now().toString(),
    ...userForm.value,
    createdAt: new Date(),
    lastLoginAt: null,
    teams: userForm.value.teams.map(teamId => {
      const team = teamOptions.find(t => t.value === teamId)
      return {
        id: teamId,
        name: team?.label || '',
        description: '',
        role: '成员'
      }
    }),
    permissions: Object.keys(userForm.value.permissions).map(moduleKey => {
      const module = availableModules.find(m => m.key === moduleKey)
      return {
        module: moduleKey,
        name: module?.name || '',
        actions: userForm.value.permissions[moduleKey]
      }
    }),
    activityLogs: []
  }

  users.value.push(newUser)
  message.success('用户已保存')
  showUserModal.value = false

  // 重置表单
  userForm.value = {
    fullName: '',
    email: '',
    role: 'LEARNER',
    status: 'active',
    teams: [],
    permissions: {}
  }
}

const sendInvites = () => {
  if (!inviteForm.value.emails.some(email => email.trim())) {
    message.error('请输入至少一个邮箱地址')
    return
  }

  const validEmails = inviteForm.value.emails.filter(email => email.trim())
  message.success(`已向 ${validEmails.length} 个邮箱发送邀请`)
  showInviteModal.value = false

  // 重置表单
  inviteForm.value = {
    emails: [''],
    role: 'LEARNER',
    message: ''
  }
}

onMounted(() => {
  // 初始化数据
  refreshData()
})
</script>

<style scoped>
.users-page {
  @apply p-6 space-y-6;
}

.page-header {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.header-content {
  @apply flex items-center justify-between;
}

.title-section h1 {
  @apply text-2xl font-bold text-white mb-1;
}

.title-section p {
  @apply text-slate-400;
}

.header-actions {
  @apply flex items-center gap-3;
}

.stats-overview {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.stats-cards {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6;
}

.stat-card {
  @apply bg-slate-700/30 rounded-lg p-4 flex items-center gap-4;
}

.stat-icon {
  @apply w-12 h-12 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center;
}

.stat-icon.active {
  @apply bg-green-500/20 text-green-400;
}

.stat-icon.roles {
  @apply bg-purple-500/20 text-purple-400;
}

.stat-icon.teams {
  @apply bg-orange-500/20 text-orange-400;
}

.stat-value {
  @apply text-2xl font-bold text-white;
}

.stat-label {
  @apply text-sm text-slate-400;
}

.main-content {
  @apply grid grid-cols-1 lg:grid-cols-3 gap-6;
}

.users-section {
  @apply lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.section-header {
  @apply flex items-center justify-between mb-6;
}

.section-title {
  @apply text-lg font-semibold text-white;
}

.section-actions {
  @apply flex items-center gap-3;
}

.users-list {
  @apply space-y-3 mb-6;
}

.user-card {
  @apply bg-slate-700/30 rounded-lg p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 hover:bg-slate-700/50;
}

.user-card.active {
  @apply bg-blue-500/20 border border-blue-500/30;
}

.user-avatar {
  @apply w-12 h-12 rounded-full overflow-hidden;
}

.user-avatar img {
  @apply w-full h-full object-cover;
}

.avatar-placeholder {
  @apply w-full h-full bg-slate-600 flex items-center justify-center text-white font-semibold;
}

.avatar-placeholder.large {
  @apply w-20 h-20 text-xl;
}

.user-info {
  @apply flex-1;
}

.user-name {
  @apply font-semibold text-white mb-1;
}

.user-email {
  @apply text-sm text-slate-400 mb-2;
}

.user-meta {
  @apply flex items-center gap-2;
}

.user-actions {
  @apply flex items-center gap-2;
}

.pagination-wrapper {
  @apply flex justify-center;
}

.user-detail {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.detail-content {
  @apply space-y-6;
}

.detail-section {
  @apply space-y-4;
}

.user-profile {
  @apply flex items-start gap-4;
}

.profile-avatar {
  @apply w-20 h-20 rounded-full overflow-hidden;
}

.profile-info {
  @apply flex-1;
}

.profile-name {
  @apply text-xl font-bold text-white mb-1;
}

.profile-email {
  @apply text-slate-400 mb-3;
}

.profile-meta {
  @apply space-y-2;
}

.meta-item {
  @apply flex items-center gap-2 text-sm;
}

.meta-label {
  @apply text-slate-400 min-w-20;
}

.meta-value {
  @apply text-white;
}

.permissions-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.permission-item {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.permission-header {
  @apply flex items-center gap-2 mb-3;
}

.permission-name {
  @apply font-medium text-white;
}

.permission-actions {
  @apply flex flex-wrap gap-2;
}

.teams-list {
  @apply space-y-3;
}

.team-item {
  @apply bg-slate-700/30 rounded-lg p-4 flex items-center justify-between;
}

.team-name {
  @apply font-medium text-white mb-1;
}

.team-description {
  @apply text-sm text-slate-400;
}

.activity-logs {
  @apply space-y-3;
}

.log-item {
  @apply bg-slate-700/30 rounded-lg p-3 flex items-start gap-3;
}

.log-time {
  @apply text-xs text-slate-500 min-w-16;
}

.log-content {
  @apply flex-1;
}

.log-action {
  @apply font-medium text-white mb-1;
}

.log-details {
  @apply text-sm text-slate-400;
}

.log-ip {
  @apply text-xs text-slate-500;
}

.empty-detail {
  @apply text-center py-16;
}

.empty-icon {
  @apply text-slate-500 mb-4;
}

.empty-detail h3 {
  @apply text-xl font-semibold text-white mb-2;
}

.empty-detail p {
  @apply text-slate-400;
}

.user-modal,
.invite-modal {
  @apply w-full max-w-4xl;
}

.user-form,
.invite-form {
  @apply space-y-4;
}

.form-row {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.form-item {
  @apply flex-1;
}

.permissions-config {
  @apply space-y-4;
}

.module-permissions {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.module-header {
  @apply mb-3;
}

.module-actions {
  @apply pl-6;
}

.modal-actions {
  @apply flex justify-end gap-3 pt-4 border-t border-slate-700/50;
}
</style>