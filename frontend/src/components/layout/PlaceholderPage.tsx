import type { ReactNode } from 'react'
import { BrandBar } from '@/components/brand/BrandBar'
import { pageTitle } from '@/config/app'

interface PlaceholderPageProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

/**
 * Simple centred page for routes whose real UI hasn't been built yet, and for 404/error states.
 * Always sets the document title. (Moonlight shows its EST. tag here; SAF uses its brand bar.)
 */
export function PlaceholderPage({ title, subtitle, children }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <BrandBar />
      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center break-words sm:px-6">
        <title>{pageTitle(title)}</title>
        <span aria-hidden className="h-0.5 w-10 bg-gold-400" />
        <h1 className="text-4xl font-extrabold tracking-display sm:text-5xl">{title}</h1>
        {subtitle && <p className="text-ink-600">{subtitle}</p>}
        {children}
      </main>
    </div>
  )
}
