import {
  Bookmark,
  ChevronDown,
  Frame,
  LayoutPanelTop,
  LogOut,
  PanelsTopLeft,
  ReceiptText,
  UserRound,
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { memoryWallAssets } from '@/assets/memoryWall'
import { BrandBar } from '@/components/brand/BrandBar'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'

const STEPS: ReadonlyArray<{ icon: ReactNode; title: string; text: string }> = [
  { icon: <PanelsTopLeft />, title: 'Wall Setup', text: 'Set your wall size and preferences' },
  { icon: <LayoutPanelTop />, title: 'Choose Layout', text: 'Pick a layout style that fits your space' },
  { icon: <Frame />, title: 'Customise Frames', text: 'Add photos, frames and finishing details' },
  { icon: <ReceiptText />, title: 'Preview & Quote', text: 'See your design and get a quote' },
]

/**
 * SAF: the shared BrandBar (profile menu in its `actions` slot), then the hero from the mockup:
 * "Curate Your Perfect Wall." (the page's <h1>) over the sunlit header strip, with the 01–04 steps.
 * Moonlight's equivalent was a single sticky bar titled "Memory Wall Planner" (still the document title).
 */
export function PlannerHeader({ onOpenSaved }: { onOpenSaved: () => void }) {
  const bg = memoryWallAssets.headerBackground
  return (
    <>
      <BrandBar actions={<ProfileMenu onOpenSaved={onOpenSaved} />} />
      <div className="relative isolate overflow-hidden border-b border-line/60">
        <img
          src={bg.src}
          width={bg.width}
          height={bg.height}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 -z-10 size-full object-cover object-center opacity-90 select-none"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-linear-to-r from-mist-50/95 via-mist-50/70 to-mist-50/30"
        />
        {/*
          From desk (1256px): one compact row, title left and steps right. The title is the reference's
          3.25rem; the planner's fluid root font (index.css) scales it with the rest of the page.
        */}
        <div className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-12 desk:flex-row desk:items-center desk:justify-between desk:gap-8 desk:py-4">
          <div className="min-w-0 desk:shrink-0">
            <h1 className="text-[clamp(1.875rem,6vw,3.25rem)] leading-[1.05] font-extrabold tracking-display text-balance desk:text-[3.25rem] desk:whitespace-nowrap">
              Curate Your Perfect Wall.
            </h1>
            <p className="mt-2 text-base text-ink-600 sm:text-lg desk:mt-1.5">
              Design, personalise and preview your own gallery wall.
            </p>
          </div>
          <StepStrip />
        </div>
      </div>
    </>
  )
}

/** SAF-only: the mockup's 01–04 journey. Informational (not navigation), so an ordered list. */
function StepStrip() {
  return (
    <ol className="-mx-4 flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 desk:max-w-[46rem] desk:min-w-0 desk:flex-1">
      {STEPS.map((step, i) => (
        <li key={step.title} className="flex min-w-44 snap-start items-start gap-2.5 sm:min-w-0">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-brand-700 shadow-field [&>svg]:size-4"
          >
            {step.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-lg leading-none font-extrabold text-ink-900">
              <span className="sr-only">Step </span>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="mt-1 block text-sm font-semibold text-ink-800">{step.title}</span>
            <span className="mt-0.5 block text-xs text-ink-600">{step.text}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Menu button pattern: Esc / outside click close, arrow keys move between items. */
function ProfileMenu({ onOpenSaved }: { onOpenSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const item =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink-700 hover:bg-mist-100 focus:bg-mist-100 focus:outline-none [&>svg]:size-4 [&>svg]:text-brand-600'

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-2 pl-1 shadow-field transition-colors hover:border-ink-300"
      >
        <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-brand-800">
          <UserRound aria-hidden className="size-4.5" />
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'hidden size-4 text-ink-500 transition-transform min-[400px]:block',
            open && 'rotate-180',
          )}
        />
        <span className="sr-only">Profile</span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label="Profile"
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-50 mt-2 w-60 animate-[toast-in_160ms_ease-out] rounded-xl border border-line bg-surface p-1.5 shadow-float"
        >
          <p className="px-3 pt-2 pb-2.5 text-xs text-ink-500">
            Signed in · <span className="font-medium text-ink-700">{user?.full_name || 'Customer'}</span>
          </p>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false)
              onOpenSaved()
            }}
          >
            <Bookmark aria-hidden /> My Saved Templates
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={async () => {
              await logout()
              navigate(ROUTES.login, { replace: true })
            }}
          >
            <LogOut aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
