import { api } from '@/api/client'
import { parseContentDispositionFilename } from '@/lib/fileDownload'
import type { PublicProposalResponse, PublicProposalResponseSubmit } from '@/types/sales'

/**
 * Public proposal response endpoints — no auth header required.
 * The token is embedded in the URL path, not the Authorization header.
 */

export async function getPublicProposalResponse(token: string): Promise<PublicProposalResponse> {
  const { data } = await api.get<PublicProposalResponse>(
    `/api/sales/public/proposal-response/${token}/`,
  )
  return data
}

export async function submitPublicProposalResponse(
  token: string,
  payload: PublicProposalResponseSubmit,
): Promise<PublicProposalResponse> {
  const { data } = await api.post<PublicProposalResponse>(
    `/api/sales/public/proposal-response/${token}/`,
    payload,
  )
  return data
}

/**
 * Download client proposal PDF (public - token auth).
 * Returns blob and suggested filename on success.
 */
export async function downloadPublicProposalPdf(
  token: string,
): Promise<{ blob: Blob; filename: string }> {
  const res = await api.get(`/api/sales/public/proposal-response/${token}/client-document/pdf/`, {
    responseType: 'blob',
  })
  const contentDisposition = res.headers['content-disposition'] as string | undefined
  const filename = parseContentDispositionFilename(contentDisposition) ?? 'commercial-proposal.pdf'
  return { blob: res.data as Blob, filename }
}
