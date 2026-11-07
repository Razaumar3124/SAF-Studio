import { CheckCircle2, ExternalLink, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import type { QuotePrepareResponse } from '@/types/api'

interface QuotePreparedDialogProps {
  open: boolean
  onClose: () => void
  quote: QuotePrepareResponse | null
}

export function QuotePreparedDialog({ open, onClose, quote }: QuotePreparedDialogProps) {
  if (!quote) return null

  const handleOpenWhatsApp = () => {
    window.open(quote.whatsapp_url, '_blank', 'noopener,noreferrer')
  }

  const handleOpenReport = () => {
    window.open(quote.report_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Quote Request Prepared"
      description="Your Memory Wall design summary is ready for WhatsApp."
    >
      <div className="flex flex-col gap-4 text-ink-700">
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3.5">
          <CheckCircle2 className="size-6 shrink-0 text-brand-600" aria-hidden />
          <div className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-brand-800">
              Reference
            </span>
            <span className="block font-mono text-base font-bold text-ink-900">
              {quote.quote_id}
            </span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-ink-600">
          We’ve prepared a design summary with your high-resolution wall preview. Click below to open
          WhatsApp with your prefilled quote request and press <strong>Send</strong>.
        </p>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="primary-gradient"
            onClick={handleOpenWhatsApp}
            leftIcon={<MessageCircle className="size-4.5" aria-hidden />}
            fullWidth
            className="h-12 text-base"
          >
            Open in WhatsApp
          </Button>

          <Button
            variant="secondary"
            onClick={handleOpenReport}
            leftIcon={<ExternalLink className="size-4" aria-hidden />}
            fullWidth
          >
            View Digital Design Report
          </Button>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

