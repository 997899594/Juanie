import api from './index'

export interface Route {
  id: string
  name: string
  method: string
  path: string
  service: string
  upstream: string
  loadBalancer: string
  timeout: number
  retries: number
  auth: string
  cors: boolean
  enabled: boolean
  logging: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateRouteDto {
  name: string
  method: string
  path: string
  service: string
  upstream: string
  loadBalancer?: string
  timeout?: number
  retries?: number
  auth?: string
  cors?: boolean
  enabled?: boolean
  logging?: boolean
}

export interface UpdateRouteDto {
  name?: string
  method?: string
  path?: string
  service?: string
  upstream?: string
  loadBalancer?: string
  timeout?: number
  retries?: number
  auth?: string
  cors?: boolean
  enabled?: boolean
  logging?: boolean
}

// API functions
export const getRoutes = async (): Promise<Route[]> => {
  const response = await api.get('/routes')
  return response.data
}

export const getRoute = async (id: string): Promise<Route> => {
  const response = await api.get(`/routes/${id}`)
  return response.data
}

export const createRoute = async (data: CreateRouteDto): Promise<Route> => {
  const response = await api.post('/routes', data)
  return response.data
}

export const updateRoute = async (id: string, data: UpdateRouteDto): Promise<Route> => {
  const response = await api.put(`/routes/${id}`, data)
  return response.data
}

export const deleteRoute = async (id: string): Promise<void> => {
  await api.delete(`/routes/${id}`)
}