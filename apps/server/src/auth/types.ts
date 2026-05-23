export type TokenPair = {
  accessToken: string
  refreshToken: string
  accessExpiresAt: number
  refreshExpiresAt: number
}

export type JwtSubject = {
  userId: string
  deviceId?: string
  projectId?: string
  roles?: string[]
}
