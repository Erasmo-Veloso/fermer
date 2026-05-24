import { describe, expect, it } from 'vitest';
import { canAccessProject, hasRequiredRole } from '../../src/auth/authorization';

describe('permission and authorization rules', () => {
  it('requires a matching project scope before access is allowed', () => {
    expect(canAccessProject({ userId: 'user-1', projectId: 'project-1' }, 'project-1')).toBe(true);
    expect(canAccessProject({ userId: 'user-1', projectId: 'project-1' }, 'project-2')).toBe(false);
    expect(canAccessProject({ userId: 'user-1' }, 'project-1')).toBe(false);
  });

  it('evaluates project roles from least to most privileged', () => {
    expect(hasRequiredRole({ userId: 'user-1', roles: ['reader'] }, 'reader')).toBe(true);
    expect(hasRequiredRole({ userId: 'user-1', roles: ['reader'] }, 'developer')).toBe(false);
    expect(hasRequiredRole({ userId: 'user-1', roles: ['developer'] }, 'reader')).toBe(true);
    expect(hasRequiredRole({ userId: 'user-1', roles: ['developer'] }, 'developer')).toBe(true);
    expect(hasRequiredRole({ userId: 'user-1', roles: ['admin'] }, 'developer')).toBe(true);
    expect(hasRequiredRole({ userId: 'user-1', roles: ['admin'] }, 'admin')).toBe(true);
  });
});
