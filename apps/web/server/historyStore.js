import { loadAppEnv } from './env.js'
import crypto from 'node:crypto'
import { neon } from '@neondatabase/serverless'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

let sqlClient = null
let schemaPromise = null

export function getHistoryDatabaseUrl(env = process.env) {
  if (env === process.env) {
    loadAppEnv()
  }
  const url = (
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    env.POSTGRES_PRISMA_URL ||
    env.POSTGRES_URL_NON_POOLING ||
    env.NEON_DATABASE_URL ||
    ''
  )
  return typeof url === 'string' ? url.trim() : ''
}

export function isHistoryDatabaseConfigured(env = process.env) {
  const url = getHistoryDatabaseUrl(env)
  return Boolean(url && url !== 'postgres://...' && url !== 'postgres://')
}

export function historyDatabaseError() {
  return new Error(
    'History storage is not configured. Add a Vercel Marketplace Neon database and pull DATABASE_URL into apps/web/.env.local.',
  )
}

export function createHistoryPayload(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('History snapshot is required.')
  }

  const question = String(snapshot.question || snapshot.intent?.question || '').trim()
  if (!question) {
    throw new Error('History snapshot requires a question.')
  }

  if (!snapshot.intent || !snapshot.taxon || !snapshot.query || !snapshot.preview) {
    throw new Error('History snapshot is incomplete.')
  }

  return {
    version: 1,
    status: snapshot.workflow ? 'workflow_ready' : 'preview_ready',
    question,
    preferredLanguage: snapshot.preferredLanguage || snapshot.intent.preferredLanguage || 'Both',
    intent: snapshot.intent,
    taxon: snapshot.taxon,
    query: snapshot.query,
    preview: snapshot.preview,
    triage: snapshot.triage || null,
    workflow: snapshot.workflow || null,
    models: snapshot.models || {},
    savedAt: new Date().toISOString(),
  }
}

export function createHistorySummary(payload) {
  const previewCount = Number(payload.preview?.counts?.total || 0)
  const countries = Array.isArray(payload.intent?.countries) ? payload.intent.countries : []

  return {
    question: String(payload.question || payload.intent?.question || '').trim(),
    taxonName:
      stringOrNull(payload.taxon?.canonicalName) ||
      stringOrNull(payload.taxon?.scientificName) ||
      stringOrNull(payload.intent?.taxonText),
    regionText: stringOrNull(payload.intent?.regionText),
    countries,
    analysisType: stringOrNull(payload.intent?.analysisType),
    supportHeadline: stringOrNull(payload.triage?.support?.headline),
    recordCount: Number.isFinite(previewCount) ? previewCount : 0,
  }
}

export async function saveHistoryEntry({ userId, snapshot }) {
  if (!userId) throw new Error('History save requires a user id.')

  const payload = createHistoryPayload(snapshot)
  const summary = createHistorySummary(payload)
  const id = crypto.randomUUID()
  const sql = await getReadySql()

  const rows = await sql`
    INSERT INTO gbif_workbench_history (
      id,
      user_id,
      question,
      taxon_name,
      region_text,
      countries,
      analysis_type,
      support_headline,
      record_count,
      payload
    )
    VALUES (
      ${id},
      ${userId},
      ${summary.question},
      ${summary.taxonName},
      ${summary.regionText},
      ${JSON.stringify(summary.countries)}::jsonb,
      ${summary.analysisType},
      ${summary.supportHeadline},
      ${summary.recordCount},
      ${JSON.stringify(payload)}::jsonb
    )
    RETURNING id, question, taxon_name, region_text, countries, analysis_type,
      support_headline, record_count, created_at, updated_at
  `

  return normalizeHistoryRow(rows[0])
}

export async function listHistoryEntries({ userId, limit = DEFAULT_LIMIT }) {
  if (!userId) throw new Error('History list requires a user id.')
  const safeLimit = clampLimit(limit)
  const sql = await getReadySql()
  const rows = await sql`
    SELECT id, question, taxon_name, region_text, countries, analysis_type,
      support_headline, record_count, created_at, updated_at
    FROM gbif_workbench_history
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `

  return rows.map(normalizeHistoryRow)
}

export async function getHistoryEntry({ userId, id }) {
  if (!userId) throw new Error('History read requires a user id.')
  if (!id) throw new Error('History entry id is required.')
  const sql = await getReadySql()
  const rows = await sql`
    SELECT id, question, taxon_name, region_text, countries, analysis_type,
      support_headline, record_count, created_at, updated_at, payload
    FROM gbif_workbench_history
    WHERE user_id = ${userId} AND id = ${id}
    LIMIT 1
  `
  if (!rows[0]) return null

  const row = normalizeHistoryRow(rows[0])
  return {
    ...row,
    snapshot: normalizePayload(rows[0].payload),
  }
}

export async function updateHistoryEntry({ userId, id, snapshot }) {
  if (!userId) throw new Error('History update requires a user id.')
  if (!id) throw new Error('History entry id is required.')

  const payload = createHistoryPayload(snapshot)
  const summary = createHistorySummary(payload)
  const sql = await getReadySql()
  const rows = await sql`
    UPDATE gbif_workbench_history
    SET
      question = ${summary.question},
      taxon_name = ${summary.taxonName},
      region_text = ${summary.regionText},
      countries = ${JSON.stringify(summary.countries)}::jsonb,
      analysis_type = ${summary.analysisType},
      support_headline = ${summary.supportHeadline},
      record_count = ${summary.recordCount},
      payload = ${JSON.stringify(payload)}::jsonb,
      updated_at = now()
    WHERE user_id = ${userId} AND id = ${id}
    RETURNING id, question, taxon_name, region_text, countries, analysis_type,
      support_headline, record_count, created_at, updated_at
  `
  return rows[0] ? normalizeHistoryRow(rows[0]) : null
}

export async function deleteHistoryEntry({ userId, id }) {
  if (!userId) throw new Error('History delete requires a user id.')
  if (!id) throw new Error('History entry id is required.')
  const sql = await getReadySql()
  const rows = await sql`
    DELETE FROM gbif_workbench_history
    WHERE user_id = ${userId} AND id = ${id}
    RETURNING id
  `
  return Boolean(rows[0])
}

export function __resetHistoryStoreForTests() {
  sqlClient = null
  schemaPromise = null
}

async function getReadySql() {
  if (!isHistoryDatabaseConfigured()) throw historyDatabaseError()
  const sql = getSql()
  await ensureSchema(sql)
  return sql
}

function getSql() {
  if (!sqlClient) {
    sqlClient = neon(getHistoryDatabaseUrl())
  }
  return sqlClient
}

function ensureSchema(sql) {
  if (!schemaPromise) {
    schemaPromise = sql`
      CREATE TABLE IF NOT EXISTS gbif_workbench_history (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        question text NOT NULL,
        taxon_name text,
        region_text text,
        countries jsonb NOT NULL DEFAULT '[]'::jsonb,
        analysis_type text,
        support_headline text,
        record_count bigint NOT NULL DEFAULT 0,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `.then(() => sql`
      CREATE INDEX IF NOT EXISTS gbif_workbench_history_user_created_idx
      ON gbif_workbench_history (user_id, created_at DESC)
    `)
  }
  return schemaPromise
}

function normalizeHistoryRow(row) {
  return {
    id: String(row.id),
    question: String(row.question || ''),
    taxonName: stringOrNull(row.taxon_name),
    regionText: stringOrNull(row.region_text),
    countries: normalizeCountries(row.countries),
    analysisType: stringOrNull(row.analysis_type),
    supportHeadline: stringOrNull(row.support_headline),
    recordCount: Number(row.record_count || 0),
    createdAt: normalizeDate(row.created_at),
    updatedAt: normalizeDate(row.updated_at),
  }
}

function normalizePayload(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value && typeof value === 'object' ? value : null
}

function normalizeCountries(value) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return new Date(value || Date.now()).toISOString()
}

function clampLimit(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT)
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
