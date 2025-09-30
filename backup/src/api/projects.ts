import api from './index'

export interface Project {
  id: string
  name: string
  description?: string
  repository?: string
  status: 'active' | 'inactive' | 'archived'
  createdAt: string
  updatedAt: string
  userId: string
}

export interface CreateProjectDto {
  name: string
  description?: string
  repository?: string
}

export interface UpdateProjectDto {
  name?: string
  description?: string
  repository?: string
  status?: 'active' | 'inactive' | 'archived'
}

// 获取项目列表
export const getProjects = async (): Promise<Project[]> => {
  return await api.get('/projects')
}

// 获取单个项目
export const getProject = async (id: string): Promise<Project> => {
  return await api.get(`/projects/${id}`)
}

// 创建项目
export const createProject = async (data: CreateProjectDto): Promise<Project> => {
  return await api.post('/projects', data)
}

// 更新项目
export const updateProject = async (id: string, data: UpdateProjectDto): Promise<Project> => {
  return await api.patch(`/projects/${id}`, data)
}

// 删除项目
export const deleteProject = async (id: string): Promise<void> => {
  return await api.delete(`/projects/${id}`)
}