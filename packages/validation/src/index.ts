import { z } from 'zod'

export const envSchema = z.object({
	NODE_ENV: z.string().optional(),
	PORT: z.string().optional(),
	DATABASE_URL: z.string().optional(),
	JWT_ACCESS_SECRET: z.string().optional(),
	JWT_REFRESH_SECRET: z.string().optional(),
	JWT_ACCESS_TTL: z.string().optional(),
	JWT_REFRESH_TTL: z.string().optional()
})

export const authHeaderSchema = z.object({
	authorization: z.string().startsWith('Bearer ').optional()
})

export const uuidSchema = z.string().uuid()

export function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown): T {
	return schema.parse(value)
}
