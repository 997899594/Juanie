export type DeploymentStatus =
  | 'pending'
  | 'deploying'
  | 'syncing'
  | 'deployed'
  | 'failed'
  | 'rolled_back'

export type ProjectStatus = 'initializing' | 'active' | 'archived' | 'failed'

export type TeamRole = 'owner' | 'admin' | 'member'

export type ProjectRole = 'owner' | 'maintainer' | 'developer' | 'viewer'

export type EnvironmentName = 'development' | 'staging' | 'production'

export const STATUS_COLORS: Record<DeploymentStatus, string> = {
  pending: 'warning',
  deploying: 'default',
  syncing: 'default',
  deployed: 'success',
  failed: 'destructive',
  rolled_back: 'destructive',
}

export const STATUS_LABELS: Record<DeploymentStatus, string> = {
  pending: 'Pending',
  deploying: 'Deploying',
  syncing: 'Syncing',
  deployed: 'Deployed',
  failed: 'Failed',
  rolled_back: 'Rolled Back',
}

export const ENV_COLORS: Record<EnvironmentName, string> = {
  development: 'blue',
  staging: 'orange',
  production: 'red',
}

export const ROLE_PERMISSIONS: Record<ProjectRole, string[]> = {
  owner: ['read', 'write', 'deploy', 'admin', 'delete'],
  maintainer: ['read', 'write', 'deploy', 'admin'],
  developer: ['read', 'write', 'deploy'],
  viewer: ['read'],
}

export function hasPermission(role: ProjectRole, action: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCommitSha(sha: string | null): string {
  if (!sha) return '-'
  return sha.slice(0, 7)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function generateId(length: number = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
}
