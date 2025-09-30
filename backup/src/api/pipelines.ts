import api from './index'

export interface Pipeline {
  id: string
  name: string
  description?: string
  projectId: string
  status: 'active' | 'inactive' | 'running' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface CreatePipelineDto {
  name: string
  description?: string
  projectId: string
}

export interface UpdatePipelineDto {
  name?: string
  description?: string
  status?: 'active' | 'inactive' | 'running' | 'failed'
}

// 获取流水线列表
export const getPipelines = async (): Promise<Pipeline[]> => {
  return await api.get('/pipelines')
}

// 获取单个流水线
export const getPipeline = async (id: string): Promise<Pipeline> => {
  return await api.get(`/pipelines/${id}`)
}

// 创建流水线
export const createPipeline = async (data: CreatePipelineDto): Promise<Pipeline> => {
  return await api.post('/pipelines', data)
}

// 更新流水线
export const updatePipeline = async (id: string, data: UpdatePipelineDto): Promise<Pipeline> => {
  return await api.patch(`/pipelines/${id}`, data)
}

// 删除流水线
export const deletePipeline = async (id: string): Promise<void> => {
  return await api.delete(`/pipelines/${id}`)
}