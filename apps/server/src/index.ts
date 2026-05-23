import express from 'express'
import { loadEnv } from '../../packages/config/src'

const app = express()
const env = loadEnv()

app.get('/_health', (_req, res) => res.json({ ok: true, env: env.NODE_ENV || 'development' }))

const port = Number(process.env.PORT || 3000)
app.listen(port, () => console.log(`Fermer server listening on ${port}`))
