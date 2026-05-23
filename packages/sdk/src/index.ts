import type { User, Project } from '../../shared/src/types'

export type ApiClientOptions = { baseUrl: string; token?: string }

export class ApiClient {
  constructor(private opts: ApiClientOptions) {}

  private headers() {
    const h: Record<string, string> = { 'content-type': 'application/json' }
    if (this.opts.token) h['authorization'] = `Bearer ${this.opts.token}`
    return h
  }

  async whoami(): Promise<User> {
    const res = await fetch(`${this.opts.baseUrl}/api/auth/me`, { headers: this.headers() })
    if (!res.ok) throw new Error('Failed to fetch current user')
    return res.json()
  }

  async listProjects(): Promise<Project[]> {
    const res = await fetch(`${this.opts.baseUrl}/api/projects`, { headers: this.headers() })
    if (!res.ok) throw new Error('Failed to list projects')
    return res.json()
  }
}
