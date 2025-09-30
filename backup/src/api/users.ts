import api from './index'

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MENTOR' | 'LEARNER'
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  isActive: boolean
}

export interface CreateUserDto {
  email: string
  name: string
  password: string
  role: 'ADMIN' | 'MENTOR' | 'LEARNER'
}

export interface UpdateUserDto {
  name?: string
  role?: 'ADMIN' | 'MENTOR' | 'LEARNER'
  isActive?: boolean
}

export const getUsers = () => {
  return api.get<User[]>('/users')
}

export const getUser = (id: string) => {
  return api.get<User>(`/users/${id}`)
}

export const createUser = (data: CreateUserDto) => {
  return api.post<User>('/users', data)
}

export const updateUser = (id: string, data: UpdateUserDto) => {
  return api.put<User>(`/users/${id}`, data)
}

export const deleteUser = (id: string) => {
  return api.delete(`/users/${id}`)
}