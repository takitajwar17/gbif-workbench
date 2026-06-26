import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appEnvPath = path.resolve(__dirname, '../.env')

export function loadAppEnv() {
  return dotenv.config({ path: appEnvPath, override: false, quiet: true })
}

export function getAppEnvPath() {
  return appEnvPath
}

loadAppEnv()
