import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appEnvPath = path.resolve(__dirname, '../.env')
const appLocalEnvPath = path.resolve(__dirname, '../.env.local')

export function loadAppEnv() {
  const env = dotenv.config({ path: appEnvPath, override: false, quiet: true })
  const localEnv = dotenv.config({ path: appLocalEnvPath, override: true, quiet: true })
  return localEnv.error ? env : localEnv
}

export function getAppEnvPath() {
  return appEnvPath
}

export function getAppLocalEnvPath() {
  return appLocalEnvPath
}

loadAppEnv()
