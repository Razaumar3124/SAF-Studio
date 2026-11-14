import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/feedback/toastContext'
import { pageTitle } from '@/config/app'
import { ROUTES } from '@/config/routes'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import * as geometryApi from '@/services/geometryApi'
import { prepareQuote } from '@/services/quotesApi'
import { tokenStorage } from '@/services/tokenStorage'
import type {
  FrameItemGeometryInput,
  GenerateLayoutRequest,
  QuotePrepareResponse,
  RedesignLayoutRequest,
  RegenerateLayoutRequest,
} from '@/types/api'
import { ActionBar } from '../components/ActionBar'
import { CanvasPanel } from '../components/CanvasPanel'
import { AiAssistantPanel, FrameGapsPanel, LayoutPanel, WallConfigPanel } from '../components/ConfigPanels'
import { FrameSelectionPanel, PreviewSettingsPanel } from '../components/FramePanels'
import { FullscreenPreviewDialog } from '../components/dialogs/FullscreenPreviewDialog'
import { QuotePreparedDialog } from '../components/dialogs/QuotePreparedDialog'
import { SaveDesignDialog } from '../components/dialogs/SaveDesignDialog'
import { SavedDesignsDialog } from '../components/dialogs/SavedDesignsDialog'
import { TemplatesDialog } from '../components/dialogs/TemplatesDialog'
import { PlannerHeader } from '../components/PlannerHeader'
import { LAYOUT_STYLES, type LayoutStyleId } from '../constants'
import { usePhotoUpload } from '../hooks/usePhotoUpload'
import { usePlanner } from '../hooks/usePlanner'
import { renderWallPngBlob } from '../lib/exportImage'
import { frameGeometry, suggestLayouts } from '../lib/geometry/scene'
import type { PlannerState } from '../lib/plannerState'
import { savedDesignsStore } from '../lib/savedDesigns'
import type { PlannerTemplate } from '../lib/templates'

type DialogName = 'fullscreen' | 'templates' | 'saved' | 'save' | null

const styleLabel = (id: string) => LAYOUT_STYLES.find((s) => s.id === id)?.label ?? id

function toGeoFrames(frames: PlannerState['frames']): FrameItemGeometryInput[] {
  return frames.map((frame) => {
    const geo = frameGeometry(frame)
    return {
      item_id: frame.id,
      photo_id: frame.photo?.kind === 'upload' && frame.photo.photoId ? frame.photo.photoId : undefined,
      photo_width_inches: geo.opening.w,
      photo_height_inches: geo.opening.h,
      matting: {
        enabled: frame.mount.enabled,
        top_inches: frame.mount.enabled ? frame.mount.marginIn : 0,
        bottom_inches: frame.mount.enabled ? frame.mount.marginIn : 0,
        left_inches: frame.mount.enabled ? frame.mount.marginIn : 0,
        right_inches: frame.mount.enabled ? frame.mount.marginIn : 0,
      },
      frame_profile_width_inches: geo.profileIn,
      orientation: frame.orientation,
    }
  })
}

/**
 * Memory Wall Planner. All state lives in usePlanner; this page wires panels, dialogs and
 * toasts. Destructive actions (reset, opening a saved design) offer Undo instead of a confirm.
 */
export default function MemoryWallPage() {
  const { state, dispatch, scene } = usePlanner()
  const toast = useToast()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<DialogName>(null)
  const [generating, setGenerating] = useState(false)
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false)
  const [preparedQuote, setPreparedQuote] = useState<QuotePrepareResponse | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const isTabletUp = useMediaQuery('(min-width: 48rem)')
  // Page-level, so uploaded photos stay valid for the whole visit (collapsing a panel, Undo).
  const uploadPhoto = usePhotoUpload()

  // Latest state for deferred work (the Generate timer), without re-creating handlers.
  const latestState = useRef(state)
  useEffect(() => {
    latestState.current = state
  })

  const generateTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(generateTimer.current), [])

  const close = () => setDialog(null)
  const undoTo = (previous: PlannerState) => () => dispatch({ type: 'design/load', state: previous })

  const handleGenerate = async () => {
    if (generating) return
    window.clearTimeout(generateTimer.current)
    setGenerating(true)
    const previous = latestState.current

    try {
      const req: GenerateLayoutRequest = {
        wall: {
          width_inches: previous.wall.widthIn,
          height_inches: previous.wall.heightIn,
          has_sofa: previous.preview.sofa,
        },
        frames: toGeoFrames(previous.frames),
        layout_style: previous.layout.style,
        spacing_inches: Math.max(0.5, Math.min(12.0, previous.layout.gapIn)),
        engine_mode: 'smart_llm',
        seed: previous.layout.seed,
        variant: (previous.layout.variant + 1) % 3,
      }
      const res = await geometryApi.generateLayout(req)
      const mappedStyle = (LAYOUT_STYLES.find((s) => s.id === res.layout_type)?.id as LayoutStyleId) ?? 'grid'
      dispatch({
        type: 'layout/apply',
        style: mappedStyle,
        variant: res.variant,
        seed: res.seed,
      })
      toast({
        tone: res.fits ? 'success' : 'info',
        message:
          res.ai_rationale ||
          (res.fits
            ? `Best fit: ${styleLabel(mappedStyle)} layout, option ${res.variant + 1}. Covers ${Math.round(res.wall_coverage_percentage)}% of the wall.`
            : 'No layout fits these frames on this wall. Showing the closest match. Try smaller frames or a bigger wall.'),
        action: { label: 'Undo', onClick: undoTo(previous) },
      })
    } catch {
      // Graceful fallback to local geometry solver
      const best = suggestLayouts(previous)[0]
      if (best) {
        dispatch({ type: 'layout/apply', style: best.style, variant: best.variant })
        toast({
          tone: best.scene.fits ? 'success' : 'info',
          message: best.scene.fits
            ? `Best fit: ${styleLabel(best.style)} layout, option ${best.variant + 1}. Covers ${Math.round(best.scene.coverage * 100)}% of the wall.`
            : 'No layout fits these frames on this wall. Showing the closest match. Try smaller frames or a bigger wall.',
          action: { label: 'Undo', onClick: undoTo(previous) },
        })
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async () => {
    const previous = latestState.current
    try {
      const req: RegenerateLayoutRequest = {
        wall: {
          width_inches: previous.wall.widthIn,
          height_inches: previous.wall.heightIn,
          has_sofa: previous.preview.sofa,
        },
        frames: toGeoFrames(previous.frames),
        layout_style: previous.layout.style,
        current_seed: previous.layout.seed,
        current_variant: previous.layout.variant,
        spacing_inches: Math.max(0.5, Math.min(12.0, previous.layout.gapIn)),
      }
      const res = await geometryApi.regenerateLayout(req)
      const mappedStyle =
        (LAYOUT_STYLES.find((s) => s.id === res.layout_type)?.id as LayoutStyleId) ?? previous.layout.style
      dispatch({
        type: 'layout/apply',
        style: mappedStyle,
        variant: res.variant,
        seed: res.seed,
      })
      toast({
        tone: 'success',
        message: `Regenerated layout variation ${res.variant + 1}.`,
        action: { label: 'Undo', onClick: undoTo(previous) },
      })
    } catch {
      dispatch({ type: 'layout/regenerate' })
    }
  }

  const handleRedesign = async () => {
    const previous = latestState.current
    try {
      const req: RedesignLayoutRequest = {
        wall: {
          width_inches: previous.wall.widthIn,
          height_inches: previous.wall.heightIn,
          has_sofa: previous.preview.sofa,
        },
        frames: toGeoFrames(previous.frames),
        current_layout_style: previous.layout.style,
        spacing_inches: Math.max(0.5, Math.min(12.0, previous.layout.gapIn)),
        engine_mode: 'smart_llm',
      }
      const res = await geometryApi.redesignLayout(req)
      const mappedStyle =
        (LAYOUT_STYLES.find((s) => s.id === res.layout_type)?.id as LayoutStyleId) ?? 'grid'
      dispatch({
        type: 'layout/apply',
        style: mappedStyle,
        variant: res.variant,
        seed: res.seed,
      })
      toast({
        tone: 'success',
        message: res.ai_rationale || `Redesigned with ${styleLabel(mappedStyle)} layout.`,
        action: { label: 'Undo', onClick: undoTo(previous) },
      })
    } catch {
      dispatch({ type: 'layout/redesign' })
    }
  }

  const handleReset = () => {
    const previous = state
    dispatch({ type: 'reset' })
    toast({
      message: 'Planner reset to the default wall.',
      action: { label: 'Undo', onClick: undoTo(previous) },
    })
  }

  const handleSave = (title: string) => {
    const saved = savedDesignsStore.save(state, title, (message) =>
      toast({ tone: 'error', message: `Saved on this device only. ${message}` }),
    )
    dispatch({ type: 'design/rename', title })
    close()
    toast({
      tone: 'success',
      message: `“${saved.title}” saved to My Saved Templates.`,
      action: { label: 'View', onClick: () => setDialog('saved') },
    })
  }

  const applyTemplate = (template: PlannerTemplate) => {
    const previous = state
    dispatch({ type: 'template/apply', template, templateId: template.id })
    toast({
      tone: 'success',
      message: `Applied “${template.name}”.`,
      action: { label: 'Undo', onClick: undoTo(previous) },
    })
  }

  const handleQuote = async () => {
    if (isSubmittingQuote) return

    if (!tokenStorage.getAccessToken()) {
      toast({
        tone: 'info',
        message: 'Please sign in to request a quote for your design.',
        action: { label: 'Sign in', onClick: () => navigate(ROUTES.login) },
      })
      return
    }

    const svg = svgRef.current
    if (!svg) {
      toast({
        tone: 'error',
        message: 'Could not access the wall preview. Please try again.',
      })
      return
    }

    let popupWindow: Window | null = null
    try {
      popupWindow = window.open('about:blank', '_blank')
    } catch {
      // Ignored if window.open is restricted
    }

    setIsSubmittingQuote(true)
    try {
      let blob: Blob
      try {
        blob = await renderWallPngBlob(svg, scene, {
          title: state.title,
          unit: state.displayUnit,
          guides: false,
        })
      } catch {
        blob = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })
      }

      const res = await prepareQuote(blob, state, scene)

      if (popupWindow && !popupWindow.closed) {
        popupWindow.location.href = res.whatsapp_url
      } else {
        window.open(res.whatsapp_url, '_blank', 'noopener,noreferrer')
      }

      setPreparedQuote(res)
      toast({
        tone: 'success',
        message: `Quote ${res.quote_id} prepared! Opening WhatsApp…`,
      })
    } catch (err) {
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close()
      }
      const message = err instanceof Error ? err.message : 'Failed to prepare quote. Please try again.'
      toast({
        tone: 'error',
        message,
      })
    } finally {
      setIsSubmittingQuote(false)
    }
  }

  const collapsible = !isTabletUp

  return (
    // overflow-x-clip (not hidden): no horizontal scroll from decoration, sticky bar keeps working.
    // data-planner: planner density (fluid root font, text floors) + hidden page scrollbar (index.css).
    <div data-planner className="min-h-dvh overflow-x-clip bg-mist-50 pb-24 md:pb-8">
      <title>{pageTitle('Memory Wall Planner')}</title>
      <PlannerHeader onOpenSaved={() => setDialog('saved')} />

      {/* Fluid (no centred max-width) with the brand bar's gutters: no blank page edges on wide windows. */}
      <main className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-12 lg:py-6 desk:py-4">
        {/*
          DOM order = phone/tablet order (canvas first, as in Moonlight). From desk (1256px), a grid of nine
          fluid columns plus a right-hand column (≈ 3 of them, never under 22rem so the frame panel's
          title and photo row wrap as in the reference at 1280px) places the cards like the SAF mockup: config row on top (5 | 4 | right);
          canvas (9) + frame panel (right); inspiration (6) + preview settings (3) under the canvas.
          Rows `auto auto 1fr`: when the frame panel (rows 2–3) is taller than canvas + row 3, the spare
          height goes below row 3 only (no blank band under the canvas), and row-3 cards hug their content.
        */}
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 desk:grid-cols-[repeat(9,minmax(0,1fr))_minmax(22rem,3fr)] desk:grid-rows-[auto_auto_1fr]">
          <div className="min-w-0 md:col-span-2 desk:col-span-9 desk:col-start-1 desk:row-start-2">
            <CanvasPanel
              state={state}
              dispatch={dispatch}
              scene={scene}
              svgRef={svgRef}
              generating={generating}
              onSave={() => setDialog('save')}
              onReset={handleReset}
              onGenerate={handleGenerate}
              onRegenerate={handleRegenerate}
              onRedesign={handleRedesign}
            />
          </div>
          <div className="min-w-0 md:col-span-2 desk:col-span-5 desk:col-start-1 desk:row-start-1 desk:h-full [&>section]:h-full">
            <WallConfigPanel state={state} dispatch={dispatch} collapsible={collapsible} />
          </div>
          <div className="min-w-0 desk:col-span-4 desk:col-start-6 desk:row-start-1 desk:h-full [&>section]:h-full">
            <LayoutPanel state={state} dispatch={dispatch} collapsible={collapsible} />
          </div>
          <div className="min-w-0 desk:col-start-10 desk:row-start-1 desk:h-full [&>section]:h-full">
            <FrameGapsPanel state={state} dispatch={dispatch} collapsible={collapsible} />
          </div>
          <div className="min-w-0 md:col-span-2 desk:col-span-6 desk:col-start-1 desk:row-start-3">
            <AiAssistantPanel state={state} onApplyTemplate={applyTemplate} collapsible={collapsible} />
          </div>
          <div className="min-w-0 desk:col-start-10 desk:row-span-2 desk:row-start-2">
            <FrameSelectionPanel
              state={state}
              dispatch={dispatch}
              collapsible={collapsible}
              onUpload={uploadPhoto}
            />
          </div>
          <div className="min-w-0 desk:col-span-3 desk:col-start-7 desk:row-start-3">
            <PreviewSettingsPanel state={state} dispatch={dispatch} />
          </div>
        </div>

        <ActionBar
          onFullscreen={() => setDialog('fullscreen')}
          onTemplates={() => setDialog('templates')}
          onSaved={() => setDialog('saved')}
          onQuote={handleQuote}
          isSubmittingQuote={isSubmittingQuote}
        />
      </main>

      <FullscreenPreviewDialog
        open={dialog === 'fullscreen'}
        onClose={close}
        state={state}
        scene={scene}
        dispatch={dispatch}
      />
      <TemplatesDialog
        open={dialog === 'templates'}
        onClose={close}
        state={state}
        onApply={(template) => {
          applyTemplate(template)
          close()
        }}
      />
      <SavedDesignsDialog
        open={dialog === 'saved'}
        onClose={close}
        unit={state.displayUnit}
        onSaveCurrent={() => setDialog('save')}
        onOpenDesign={async (design) => {
          const previous = state
          try {
            const loadedState = await savedDesignsStore.loadDesignDetail(design)
            dispatch({ type: 'design/load', state: loadedState })
          } catch {
            dispatch({ type: 'design/load', state: design.state })
          }
          close()
          toast({
            message: `Opened “${design.title}”.`,
            action: { label: 'Undo', onClick: undoTo(previous) },
          })
        }}
      />
      <SaveDesignDialog
        open={dialog === 'save'}
        onClose={close}
        defaultTitle={state.title}
        hasUploads={state.frames.some((f) => f.photo?.kind === 'upload')}
        onSave={handleSave}
      />
      <QuotePreparedDialog
        open={Boolean(preparedQuote)}
        onClose={() => setPreparedQuote(null)}
        quote={preparedQuote}
      />
    </div>
  )
}
