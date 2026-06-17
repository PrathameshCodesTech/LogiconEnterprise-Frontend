import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Download } from 'lucide-react'
import {
  getProposalVersion,
  listProposalBudgetLines,
  listProposalBreakupLines,
  getSalesLead,
  downloadClientProposalPdf,
} from '@/api/sales'
import type { ProposalVersion, ProposalBudgetLine, ProposalBreakupLine, SalesLead } from '@/types/sales'
import { parseApiError } from '@/lib/apiError'
import { saveBlob, parseBlobError } from '@/lib/fileDownload'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { ClientProposalDocument } from './ClientProposalDocument'
import { clientProposalDataFromInternal } from './clientProposalDocumentData'

export function ClientProposalPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const proposalId = Number(id)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<ProposalVersion | null>(null)
  const [lead, setLead] = useState<SalesLead | null>(null)
  const [budgetLines, setBudgetLines] = useState<ProposalBudgetLine[]>([])
  const [breakupLines, setBreakupLines] = useState<ProposalBreakupLine[]>([])
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(proposalId) || proposalId < 1) {
      setError('Invalid proposal ID')
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [proposalData, budgetRes, breakupRes] = await Promise.all([
          getProposalVersion(proposalId),
          listProposalBudgetLines({ proposal_version: proposalId }),
          listProposalBreakupLines({ proposal_version: proposalId }),
        ])
        setProposal(proposalData)
        setBudgetLines(budgetRes.items)
        setBreakupLines(breakupRes.items)

        // Load lead for client context
        if (proposalData.lead) {
          try {
            const leadData = await getSalesLead(proposalData.lead)
            setLead(leadData)
          } catch {
            // Lead is optional, don't fail the whole page
          }
        }
      } catch (e) {
        const parsed = parseApiError(e, 'Failed to load proposal')
        setError(parsed.message)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [proposalId])

  async function handleDownloadPdf() {
    setPdfDownloading(true)
    setPdfError(null)
    try {
      const { blob, filename } = await downloadClientProposalPdf(proposalId)
      // Check if backend returned JSON error instead of PDF
      if (blob.type === 'application/json') {
        setPdfError(await parseBlobError(blob))
        return
      }
      saveBlob(blob, filename)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
        setPdfError(await parseBlobError(err.response.data))
      } else {
        setPdfError(parseApiError(err, 'Failed to download PDF').message)
      }
    } finally {
      setPdfDownloading(false)
    }
  }

  function goBack() {
    navigate(`/sales/proposals/${proposalId}`)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading proposal..." />
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorState message={error || 'Proposal not found'} />
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={goBack}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Proposal
          </Button>
        </div>
      </div>
    )
  }

  const documentData = clientProposalDataFromInternal(proposal, lead)

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Header bar */}
      <div className="no-print sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[210mm] items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={goBack} className="min-h-9 px-3">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="font-semibold text-gray-900">Client Proposal Preview</h1>
              <p className="text-sm text-gray-500">
                {documentData.clientName} - Version {documentData.proposalVersion}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => void handleDownloadPdf()}
            disabled={pdfDownloading}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {pdfDownloading ? 'Downloading...' : 'Download PDF'}
          </Button>
        </div>
        {pdfError && (
          <div className="mx-auto mt-2 max-w-[210mm]">
            <p className="text-sm text-red-600">{pdfError}</p>
          </div>
        )}
      </div>

      {/* Document */}
      <div className="p-6 print:p-0">
        <ClientProposalDocument
          data={documentData}
          budgetLines={budgetLines}
          breakupLines={breakupLines}
        />
      </div>
    </div>
  )
}
