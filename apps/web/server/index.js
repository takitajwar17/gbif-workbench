// Local dev only: a thin Express shell that mounts the same handlers
// Vercel serves from `apps/web/api/*.js`. In production the same files
// are deployed as Vercel serverless functions and this file is not used.
import './env.js'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import historyHandler from '../api/history.js'
import healthHandler from '../api/health.js'
import parseIntentHandler from '../api/parse-intent.js'
import studyPlanHandler from '../api/study-plan.js'
import workflowHandler from '../api/workflow.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const port = Number(process.env.PORT || 8787)

app.use(express.json({ limit: '2mb' }))

app.get('/api/health', healthHandler)
app.all('/api/history', historyHandler)
app.post('/api/parse-intent', parseIntentHandler)
app.post('/api/study-plan', studyPlanHandler)
app.post('/api/workflow', workflowHandler)

const distPath = path.resolve(__dirname, '../dist')
app.use(express.static(distPath))
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distPath, 'index.html'))
})

app.listen(port, '127.0.0.1', () => {
  console.log(`GBIF Workbench API listening on http://127.0.0.1:${port}`)
})
