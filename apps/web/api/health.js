import { createHealthResponse } from '../server/workflow.js'

// Vercel Node.js serverless function: GET /api/health
export default function handler(_req, res) {
  res.status(200).json(createHealthResponse())
}