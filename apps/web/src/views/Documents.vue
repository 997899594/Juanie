<template>
  <div class="documents-page">
    <div class="header">
      <h1>文档管理</h1>
      <p>管理和查看您的文档</p>
    </div>
    
    <div class="content">
      <div class="documents-grid">
        <div class="document-card" v-for="doc in documents" :key="doc.id">
          <h3>{{ doc.title || `文档 ${doc.id}` }}</h3>
          <p>{{ doc.content?.substring(0, 100) }}...</p>
          <div class="document-actions">
            <button @click="viewDocument(doc.id)">查看</button>
            <button @click="editDocument(doc.id)">编辑</button>
          </div>
        </div>
        
        <div class="document-card add-new" @click="createDocument">
          <div class="add-icon">+</div>
          <p>创建新文档</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { trpc, type AppRouter } from '../lib/trpc'

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
    console.error('加载文档失败:', error)
  } finally {
    loading.value = false
  }
}

const viewDocument = (id: string) => {
  console.log('查看文档:', id)
}

const editDocument = (id: string) => {
  console.log('编辑文档:', id)
  // TODO: 实现文档编辑功能
}

const createDocument = () => {
  console.log('创建新文档')
  // TODO: 实现文档创建功能
}

onMounted(() => {
  loadDocuments()
})
</script>

<style scoped>
.documents-page {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.header p {
  color: #666;
}

.documents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.document-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s;
}

.document-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.document-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.document-card p {
  color: #666;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.document-actions {
  display: flex;
  gap: 0.5rem;
}

.document-actions button {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.document-actions button:hover {
  background-color: #f9fafb;
}

.add-new {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-style: dashed;
  color: #666;
}

.add-new:hover {
  color: #333;
  border-color: #333;
}

.add-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}
</style>