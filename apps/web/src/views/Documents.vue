<template>
  <PageContainer title="文档管理" description="管理和查看您的文档">
    <template #actions>
      <Button @click="createDocument">
        <Plus class="mr-2 h-4 w-4" />
        创建文档
      </Button>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnimatedCard
        v-for="(doc, index) in documents"
        :key="doc.id"
        :index="index"
        class="cursor-pointer"
        @click="viewDocument(doc.id)"
      >
        <CardHeader>
          <CardTitle>{{ doc.title || `文档 ${doc.id}` }}</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground line-clamp-3">
            {{ doc.content?.substring(0, 100) }}...
          </p>
          <div class="flex gap-2 mt-4">
            <Button variant="outline" size="sm" @click.stop="editDocument(doc.id)">
              编辑
            </Button>
          </div>
        </CardContent>
      </AnimatedCard>

      <AnimatedCard
        :index="documents.length"
        class="cursor-pointer border-dashed"
        @click="createDocument"
      >
        <CardContent class="flex flex-col items-center justify-center py-12">
          <Plus class="h-12 w-12 text-muted-foreground mb-2" />
          <p class="text-sm text-muted-foreground">创建新文档</p>
        </CardContent>
      </AnimatedCard>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PageContainer from '@/components/PageContainer.vue'
import AnimatedCard from '@/components/AnimatedCard.vue'
import { Button, CardHeader, CardTitle, CardContent, log } from '@juanie/ui'
import { Plus, Loader2 } from 'lucide-vue-next'

// 临时类型定义，直到后端实现 documents API
type Document = {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

const documents = ref<Document[]>([])
const loading = ref(false)

const loadDocuments = async () => {
  try {
    loading.value = true
    // 临时模拟数据，直到后端实现 documents API
    documents.value = [
      {
        id: '1',
        title: '项目文档',
        content: '这是一个示例文档',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  } catch (error) {
    log.error('加载文档失败:', error)
  } finally {
    loading.value = false
  }
}

const viewDocument = (id: string) => {
  log.info('查看文档:', id)
}

const editDocument = (id: string) => {
  log.info('编辑文档:', id)
  // TODO: 实现文档编辑功能
}

const createDocument = () => {
  log.info('创建新文档')
  // TODO: 实现文档创建功能
}

onMounted(() => {
  loadDocuments()
})
</script>