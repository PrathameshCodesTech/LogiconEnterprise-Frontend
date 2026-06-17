import { api } from '@/api/client'

export function absoluteApiFileUrl(file: string): string {
  if (!file) return file
  if (file.startsWith('http://') || file.startsWith('https://')) return file
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '')
  if (!base) return file
  if (file.startsWith('/')) return `${base}${file}`
  return `${base}/${file}`
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Parse error message from blob response.
 * When responseType is 'blob', axios returns Blob even for error responses.
 * Backend may return JSON with { detail: "..." } or { message: "..." }.
 */
export async function parseBlobError(blob: Blob): Promise<string> {
  try {
    const text = await blob.text()
    const json = JSON.parse(text) as Record<string, unknown>
    if (typeof json.detail === 'string') return json.detail
    if (typeof json.message === 'string') return json.message
    return 'Download failed'
  } catch {
    return 'Download failed'
  }
}

/**
 * Parse filename from Content-Disposition header.
 * Examples: attachment; filename="proposal.pdf" or filename=proposal.pdf
 */
export function parseContentDispositionFilename(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const quoted = /filename="([^"]+)"/i.exec(value)
  if (quoted?.[1]) return quoted[1]
  const unquoted = /filename=([^;]+)/i.exec(value)
  if (unquoted?.[1]) return unquoted[1].trim()
  return undefined
}

/** Fetch a protected media/API file with the logged-in user's bearer token. */
export async function downloadAuthenticatedFile(filePath: string, filename: string): Promise<void> {
  const url = absoluteApiFileUrl(filePath)
  const res = await api.get(url, { responseType: 'blob' })
  saveBlob(res.data as Blob, filename)
}

export async function openAuthenticatedFile(filePath: string): Promise<void> {
  const url = absoluteApiFileUrl(filePath)
  const res = await api.get(url, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(res.data as Blob)
  window.open(blobUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}
