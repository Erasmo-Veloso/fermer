import type { JwtSubject } from './types'

export type ProjectRole = 'admin' | 'developer' | 'reader'

export function canAccessProject(user: JwtSubject, projectId: string): boolean {
  if (!user.projectId) return false
  if (user.projectId !== projectId) return false
  return true
}

export function hasRequiredRole(user: JwtSubject, requiredRole: ProjectRole): boolean {
  const roles = user.roles ?? []
  if (requiredRole === 'reader') return roles.length > 0
  if (requiredRole === 'developer') return roles.includes('developer') || roles.includes('admin')
  return roles.includes('admin')
}
