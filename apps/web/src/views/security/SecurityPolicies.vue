<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSecurityPolicies, type SecurityPolicy } from '@/composables/useSecurityPolicies'
import PageContainer from '@/components/PageContainer.vue'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@juanie/ui'
import { Plus, Shield, Loader2, Edit, Trash2, Power, PowerOff } from 'lucide-vue-next'

const route = useRoute()
const organizationId = route.params.orgId as string

const {
  policies,
  loading,
  hasPolicies,
  activePolicies,
  fetchPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  togglePolicyStatus,
} = useSecurityPolicies()

// 对话框状态
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const editingPolicy = ref<SecurityPolicy | null>(null)
const deletingPolicy = ref<SecurityPolicy | null>(null)

// 表单数据
const formData = ref<{
  name: string
  type: 'access-control' | 'network' | 'data-protection' | 'compliance'
  status: 'active' | 'inactive'
  rules: string
}>({
  name: '',
  type: 'access-control',
  status: 'active',
  rules: '{}',
})

// 规则模板
const ruleTemplates: Record<string, any> = {
  basic_access: {
    name: '基础访问控制',
    rules: {
      allow: ['read'],
      deny: ['write', 'delete'],
      conditions: [
        {
          field: 'user.role',
          operator: 'equals',
          value: 'viewer'
        }
      ]
    }
  },
  admin_access: {
    name: '管理员访问',
    rules: {
      allow: ['read', 'write', 'delete', 'admin'],
      deny: [],
      conditions: [
        {
          field: 'user.role',
          operator: 'equals',
          value: 'admin'
        }
      ]
    }
  },
  network_policy: {
    name: '网络策略',
    rules: {
      ingress: {
        from: [
          {
            podSelector: {
              matchLabels: {
                role: 'frontend'
              }
            }
          }
        ],
        ports: [
          {
            protocol: 'TCP',
            port: 80
          }
        ]
      }
    }
  },
  data_protection: {
    name: '数据保护',
    rules: {
      encryption: {
        enabled: true,
        algorithm: 'AES-256'
      },
      backup: {
        enabled: true,
        frequency: 'daily',
        retention: 30
      },
      access: {
        requireMFA: true,
        allowedIPs: []
      }
    }
  }
}

const selectedTemplate = ref('')

// 应用模板
function applyTemplate() {
  if (!selectedTemplate.value) return
  const template = ruleTemplates[selectedTemplate.value]
  if (template) {
    formData.value.rules = JSON.stringify(template.rules, null, 2)
  }
}

// 策略类型选项
const policyTypes = [
  { value: 'access-control', label: '访问控制' },
  { value: 'data-protection', label: '数据保护' },
  { value: 'network', label: '网络安全' },
  { value: 'compliance', label: '合规性' },
]

// 加载策略
onMounted(async () => {
  await fetchPolicies(organizationId)
})

// 打开创建对话框
const openCreateDialog = () => {
  formData.value = {
    name: '',
    type: 'access-control',
    status: 'active',
    rules: '{}',
  }
  showCreateDialog.value = true
}

// 打开编辑对话框
const openEditDialog = (policy: SecurityPolicy) => {
  editingPolicy.value = policy
  formData.value = {
    name: policy.name,
    type: policy.type as 'access-control' | 'network' | 'data-protection' | 'compliance',
    status: policy.status as 'active' | 'inactive',
    rules: JSON.stringify(policy.rules, null, 2),
  }
  showEditDialog.value = true
}

// 打开删除对话框
const openDeleteDialog = (policy: SecurityPolicy) => {
  deletingPolicy.value = policy
  showDeleteDialog.value = true
}

// 处理创建
const handleCreate = async () => {
  try {
    let rules = {}
    try {
      rules = JSON.parse(formData.value.rules)
    } catch (e) {
      alert('规则 JSON 格式错误')
      return
    }

    // 确保 rules 有正确的结构
    const parsedRules = typeof rules === 'string' ? JSON.parse(rules) : rules
    const apiRules = {
      conditions: parsedRules.conditions || [],
      actions: parsedRules.actions || []
    }
    
    await createPolicy({
      organizationId,
      name: formData.value.name,
      type: formData.value.type,
      rules: apiRules,
    })

    showCreateDialog.value = false
  } catch (error) {
    console.error('创建策略失败:', error)
  }
}

// 处理更新
const handleUpdate = async () => {
  if (!editingPolicy.value) return

  try {
    let rules = {}
    try {
      rules = JSON.parse(formData.value.rules)
    } catch (e) {
      alert('规则 JSON 格式错误')
      return
    }

    // 确保 rules 有正确的结构
    const apiRules = {
      conditions: (rules as any).conditions || [],
      actions: (rules as any).actions || []
    }
    
    await updatePolicy(editingPolicy.value.id, {
      name: formData.value.name,
      rules: apiRules,
    })

    showEditDialog.value = false
    editingPolicy.value = null
  } catch (error) {
    console.error('更新策略失败:', error)
  }
}

// 处理删除
const handleDelete = async () => {
  if (!deletingPolicy.value) return

  try {
    await deletePolicy(deletingPolicy.value.id)
    showDeleteDialog.value = false
    deletingPolicy.value = null
  } catch (error) {
    console.error('删除策略失败:', error)
  }
}

// 处理状态切换
const handleToggleStatus = async (policy: SecurityPolicy) => {
  try {
    await togglePolicyStatus(policy.id)
  } catch (error) {
    console.error('切换策略状态失败:', error)
  }
}

// 获取策略类型标签
const getPolicyTypeLabel = (type: string) => {
  return policyTypes.find(t => t.value === type)?.label || type
}

// 格式化日期
const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}
</script>

<template>
  <PageContainer title="安全策略" description="管理组织的安全策略和规则">
    <template #actions>
      <Button @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" />
        创建策略
      </Button>
    </template>

    <!-- 统计卡片 -->
    <div class="grid gap-4 md:grid-cols-3 mb-6">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">总策略数</CardTitle>
          <Shield class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ policies.length }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">活跃策略</CardTitle>
          <Power class="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-green-600">{{ activePolicies.length }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">非活跃策略</CardTitle>
          <PowerOff class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-muted-foreground">
            {{ policies.length - activePolicies.length }}
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && !hasPolicies" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- 空状态 -->
    <Card v-else-if="!hasPolicies">
      <CardContent class="flex flex-col items-center justify-center py-12">
        <Shield class="h-12 w-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">暂无安全策略</h3>
        <p class="text-sm text-muted-foreground mb-4">创建第一个安全策略来保护您的组织</p>
        <Button @click="openCreateDialog">
          <Plus class="mr-2 h-4 w-4" />
          创建策略
        </Button>
      </CardContent>
    </Card>

    <!-- 策略列表 -->
    <Card v-else>
      <CardHeader>
        <CardTitle>策略列表</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead class="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="policy in policies" :key="policy.id">
                <TableCell class="font-medium">{{ policy.name }}</TableCell>
                <TableCell>
                  <Badge variant="outline">{{ getPolicyTypeLabel(policy.type) }}</Badge>
                </TableCell>
                <TableCell>
                  <Badge :variant="policy.status === 'active' ? 'default' : 'secondary'">
                    {{ policy.status === 'active' ? '活跃' : '非活跃' }}
                  </Badge>
                </TableCell>
                <TableCell>{{ formatDate(policy.createdAt) }}</TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      @click="handleToggleStatus(policy)"
                      :title="policy.status === 'active' ? '停用' : '启用'"
                    >
                      <Power
                        v-if="policy.status === 'active'"
                        class="h-4 w-4 text-green-500"
                      />
                      <PowerOff v-else class="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" @click="openEditDialog(policy)">
                      <Edit class="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      @click="openDeleteDialog(policy)"
                    >
                      <Trash2 class="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <!-- 创建策略对话框 -->
    <Dialog v-model:open="showCreateDialog">
      <DialogContent class="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>创建安全策略</DialogTitle>
          <DialogDescription>
            创建新的安全策略来保护您的组织资源
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label for="name">策略名称</Label>
            <Input
              id="name"
              v-model="formData.name"
              placeholder="输入策略名称"
            />
          </div>
          <div class="grid gap-2">
            <Label for="type">策略类型</Label>
            <Select v-model="formData.type">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="type in policyTypes"
                  :key="type.value"
                  :value="type.value"
                >
                  {{ type.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label for="status">状态</Label>
            <Select v-model="formData.status">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">活跃</SelectItem>
                <SelectItem value="inactive">非活跃</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <div class="flex items-center justify-between">
              <Label for="rules">规则配置 (JSON)</Label>
              <Select v-model="selectedTemplate" @update:modelValue="applyTemplate">
                <SelectTrigger class="w-[200px]">
                  <SelectValue placeholder="选择模板" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">自定义</SelectItem>
                  <SelectItem
                    v-for="(template, key) in ruleTemplates"
                    :key="key"
                    :value="key"
                  >
                    {{ template.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              id="rules"
              v-model="formData.rules"
              placeholder='{"allow": ["read", "write"]}'
              rows="10"
              class="font-mono text-sm"
            />
            <p class="text-xs text-muted-foreground">
              提示：选择模板快速开始，或手动编辑 JSON 配置
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateDialog = false">
            取消
          </Button>
          <Button @click="handleCreate" :disabled="loading">
            <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 编辑策略对话框 -->
    <Dialog v-model:open="showEditDialog">
      <DialogContent class="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>编辑安全策略</DialogTitle>
          <DialogDescription>
            修改安全策略的配置和规则
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label for="edit-name">策略名称</Label>
            <Input
              id="edit-name"
              v-model="formData.name"
              placeholder="输入策略名称"
            />
          </div>
          <div class="grid gap-2">
            <Label for="edit-type">策略类型</Label>
            <Select v-model="formData.type">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="type in policyTypes"
                  :key="type.value"
                  :value="type.value"
                >
                  {{ type.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label for="edit-status">状态</Label>
            <Select v-model="formData.status">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">活跃</SelectItem>
                <SelectItem value="inactive">非活跃</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <div class="flex items-center justify-between">
              <Label for="edit-rules">规则配置 (JSON)</Label>
              <Select v-model="selectedTemplate" @update:modelValue="applyTemplate">
                <SelectTrigger class="w-[200px]">
                  <SelectValue placeholder="选择模板" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">自定义</SelectItem>
                  <SelectItem
                    v-for="(template, key) in ruleTemplates"
                    :key="key"
                    :value="key"
                  >
                    {{ template.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              id="edit-rules"
              v-model="formData.rules"
              placeholder='{"allow": ["read", "write"]}'
              rows="10"
              class="font-mono text-sm"
            />
            <p class="text-xs text-muted-foreground">
              提示：选择模板快速开始，或手动编辑 JSON 配置
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEditDialog = false">
            取消
          </Button>
          <Button @click="handleUpdate" :disabled="loading">
            <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
            更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 删除确认对话框 -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>确认删除策略？</DialogTitle>
          <DialogDescription>
            此操作将永久删除策略 "{{ deletingPolicy?.name }}"。此操作无法撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">取消</Button>
          <Button variant="destructive" @click="handleDelete" :disabled="loading">
            <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </PageContainer>
</template>
