import axios from 'axios'

export interface ParsedApiError {
  message: string
  fields: Record<string, string>
}

function stringifyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(stringifyValue).filter(Boolean).join(' ')
  }
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nested]) => `${key}: ${stringifyValue(nested)}`)
      .filter(Boolean)
      .join(' ')
  }
  return value == null ? '' : String(value)
}

export function parseApiError(error: unknown, fallback = 'Request failed'): ParsedApiError {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : fallback, fields: {} }
  }

  const data = error.response?.data
  if (!data || typeof data !== 'object') {
    return { message: error.message || fallback, fields: {} }
  }

  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const msg = stringifyValue(value)
    if (msg) fields[key] = msg
  }

  const message =
    fields.detail ||
    fields.non_field_errors ||
    Object.entries(fields)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' ') ||
    fallback

  return { message, fields }
}


