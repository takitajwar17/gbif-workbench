import type { Risk } from './types'

// Lookup tables + helpers for risk/support styling. Hoisted so every consumer
// (RiskPanel, RiskCard, SupportPanel, RiskDetail) shares a single source of
// truth for severity classes and badge variants.

const RISK_WEIGHT_MAP: Record<Risk['level'], number> = {
  BLOCKING: 5,
  HIGH: 4,
  MODERATE: 3,
  UNKNOWN: 2,
  LOW: 1,
}

const RISK_TONE_MAP: Record<Risk['level'], string> = {
  BLOCKING: 'border-red-200 bg-red-50/70',
  HIGH: 'border-red-200 bg-red-50/70',
  MODERATE: 'border-amber-200 bg-amber-50/70',
  UNKNOWN: 'border-amber-200 bg-amber-50/70',
  LOW: 'border-emerald-200 bg-emerald-50/70',
}

const RISK_BADGE_VARIANT_MAP: Record<Risk['level'], 'destructive' | 'warning' | 'success'> = {
  BLOCKING: 'destructive',
  HIGH: 'destructive',
  MODERATE: 'warning',
  UNKNOWN: 'warning',
  LOW: 'success',
}

const SUPPORT_TONE_MAP: Record<'good' | 'caution' | 'danger', string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  caution: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-950',
}

export function riskWeight(level: string) {
  return RISK_WEIGHT_MAP[level as Risk['level']] ?? 0
}

export function riskToneClass(level: Risk['level']) {
  return RISK_TONE_MAP[level]
}

export function riskBadgeVariant(level: Risk['level']) {
  return RISK_BADGE_VARIANT_MAP[level]
}

export function supportToneClass(tone: 'good' | 'caution' | 'danger') {
  return SUPPORT_TONE_MAP[tone]
}