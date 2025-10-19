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
import { trpc } from '../lib/trpc'

interface Document {
  id: number
  content: string
  title?: string
}

const documents = ref<Document[]>([])
const loading = ref(false)

const loadDocuments = async () => {
  try {
    loading.value = true
    const result = await trpc.getDocuments.query()
    documents.value = result || []
  } catch (error) {
    console.error('加载文档失败:', error)
  } finally {
    loading.value = false
  }
}

const viewDocument = (id: number) => {
  console.log('查看文档:', id)
  // TODO: 实现文档查看功能
}

const editDocument = (id: number) => {
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