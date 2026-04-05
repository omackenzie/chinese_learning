import express from 'express'
import cors from 'cors'
import generateRoutes from './routes/generate.js'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api', generateRoutes)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
