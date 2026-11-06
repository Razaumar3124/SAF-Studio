// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthBackdropAsset } from '@/assets/types'
import { AuthHeader } from './AuthHeader'
import { AuthLayout } from './AuthLayout'
import { LoginForm } from './LoginForm'

/**
 * Regression tests (audit 2026-11-06) for the SAF auth shell:
 * - crossing the `hero-fits` breakpoint mid-typing (rotate a tablet, resize a window) swaps the
 *   backdrop for the decorations but must NOT remount the form and lose what was typed;
 * - the backdrop image is only mounted (downloaded) under `hero-fits`;
 * - the baked-in tagline is never duplicated as live text while the image is shown.
 */
const hero: AuthBackdropAsset = {
  src: '/login.webp',
  srcSet: '/login.webp 1585w',
  width: 1585,
  height: 992,
  objectPosition: '100% 50%',
  cardSide: 'left',
  artEdge: 0.52,
  captionEdge: 0.11,
  edgeFill: { left: ['#111111', '#222222'], right: ['#999999', '#888888'] },
  alt: 'Gallery wall. Your space. Your art. Your story.',
  tagline: { title: 'Your space. Your art. Your story.', subtitle: 'Sub.' },
}

let matches = false
const listeners = new Set<() => void>()
let viewport = { width: 1440, height: 900 }

/** jsdom has no layout: drive the viewport that useBackdropFits measures. */
function setViewport(width: number, height: number) {
  act(() => {
    viewport = { width, height }
    window.dispatchEvent(new Event('resize'))
  })
}

beforeEach(() => {
  matches = false
  listeners.clear()
  viewport = { width: 1440, height: 900 }
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    get: () => viewport.width,
  })
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewport.height })
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  }))
})
afterEach(() => cleanup())

const setHeroFits = (value: boolean) =>
  act(() => {
    matches = value
    for (const cb of listeners) cb()
  })

const renderLogin = () =>
  render(
    <MemoryRouter>
      <AuthLayout hero={hero} variant="login">
        <LoginForm />
      </AuthLayout>
    </MemoryRouter>,
  )

describe('AuthLayout', () => {
  it('keeps typed values and focus when the layout switches mid-typing', () => {
    renderLogin()
    const identifier = screen.getByLabelText('Mobile No. or Email')
    identifier.focus()
    fireEvent.change(identifier, { target: { value: 'asha@example.com' } })

    setHeroFits(true) // e.g. tablet rotated to landscape
    expect(screen.getByRole('img', { name: /Your space/ })).toBeTruthy()
    expect(screen.getByLabelText('Mobile No. or Email')).toBe(identifier) // same node: not remounted
    expect((identifier as HTMLInputElement).value).toBe('asha@example.com')
    expect(document.activeElement).toBe(identifier)

    setHeroFits(false)
    expect((screen.getByLabelText('Mobile No. or Email') as HTMLInputElement).value).toBe('asha@example.com')
  })

  it('mounts the backdrop only under hero-fits, and never duplicates the baked tagline', () => {
    renderLogin()
    expect(screen.queryByRole('img', { name: /Your space/ })).toBeNull()
    expect(screen.getByText('Your space. Your art. Your story.')).toBeTruthy() // live text, no image

    setHeroFits(true)
    expect(screen.getByRole('img', { name: /Your space/ })).toBeTruthy()
    expect(screen.queryByText('Your space. Your art. Your story.')).toBeNull() // only in alt
  })

  it('marks <main> with data-backdrop only in backdrop mode (drives the on-backdrop: CSS variant)', () => {
    renderLogin()
    const main = screen.getByRole('main')
    expect(main.hasAttribute('data-backdrop')).toBe(false)
    setHeroFits(true)
    expect(main.hasAttribute('data-backdrop')).toBe(true)
  })

  it('falls back to the image-free layout when the card cannot fit beside the art (Register at 4:3)', () => {
    const register: AuthBackdropAsset = {
      ...hero,
      width: 1672,
      height: 941,
      cardSide: 'right',
      artEdge: 990 / 1672,
      captionEdge: 1570 / 1672,
      alt: 'Gallery room. Every wall begins with a story.',
      tagline: {
        title: 'Every wall begins with a story.',
        subtitle: 'Sub.',
        steps: ['Personalise', 'Visualise', 'Create'],
      },
    }
    setViewport(1024, 768)
    render(
      <MemoryRouter>
        <AuthLayout hero={register} variant="register" compact>
          <LoginForm />
        </AuthLayout>
      </MemoryRouter>,
    )
    setHeroFits(true) // hero-fits matches at 1024×768 …
    expect(screen.queryByRole('img', { name: /Every wall/ })).toBeNull() // … but the card wouldn't fit
    expect(screen.getByText('Every wall begins with a story.')).toBeTruthy()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '01Personalise',
      '02Visualise',
      '03Create',
    ])

    const identifier = screen.getByLabelText('Mobile No. or Email')
    fireEvent.change(identifier, { target: { value: '9876543210' } })
    setViewport(1440, 900) // window widened: now it fits
    expect(screen.getByRole('img', { name: /Every wall/ })).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull() // steps are baked into the image now
    expect(screen.getByLabelText('Mobile No. or Email')).toBe(identifier)
    expect((identifier as HTMLInputElement).value).toBe('9876543210')
  })

  // Regression (user report, wide 1080p windows): capped backdrop left blank side margins.
  // Regression (user report, short 150% laptop): the blurred ambient copy read as a seam + smear.
  it('fills wide-window margins by continuing the image edge colours (CSS only, one image)', () => {
    renderLogin()
    setHeroFits(true)
    const images = document.querySelectorAll('main img[srcset]') // the Google "G" icon has none
    expect(images).toHaveLength(1) // no second decode, no blur
    expect(images[0]?.getAttribute('alt')).toBe(hero.alt)
    expect(document.querySelector('main [class*="blur"]')).toBeNull()
    const fill = document.querySelector<HTMLElement>('main [data-edge-fill]')
    expect(fill).toBeTruthy()
    expect(fill?.style.backgroundImage).toContain('rgb(17, 17, 17)') // left stops (jsdom normalises hex)
    expect(fill?.style.backgroundImage).toContain('rgb(153, 153, 153)') // right stops
    // Aligned with the rendered image (backdropStyle vars), one band per half.
    expect(fill?.style.backgroundSize).toBe('50% var(--ih)')
    expect(fill?.style.backgroundPosition).toContain('var(--img-top)')
    expect(screen.getAllByRole('img', { name: /Your space/ })).toHaveLength(1)
  })

  // Regression (user report: oversized controls; Login scrolled on short laptops and phones). Sizes
  // come from the fluid `--auth-*` tokens (values: authTokens.test.ts; fit: Chromium sweeps).
  it('sizes every auth element from the fluid tokens scoped to <main data-auth>', () => {
    renderLogin()
    setHeroFits(true)
    const main = screen.getByRole('main')
    expect(main.hasAttribute('data-auth')).toBe(true)
    const zone = main.lastElementChild as HTMLElement
    expect(zone.className).toContain('py-(--auth-zone-py)')
    const card = screen.getByRole('form', { name: /sign in/i }).closest('.shadow-float') as HTMLElement
    expect(card.className).toContain('px-(--auth-card-px)')
    expect(card.className).toContain('py-(--auth-card-py)')
    const field = screen.getByLabelText('Mobile No. or Email').closest('.group') as HTMLElement
    expect(field.className).toContain('h-(--field-h)')
    expect(screen.getByRole('button', { name: /sign in/i }).className).toContain('h-(--auth-cta-h)')
    // No fixed breakpoint / density overrides left on the card or its contents.
    for (const el of [card, ...card.querySelectorAll('*')])
      expect(el.getAttribute('class') ?? '').not.toMatch(
        /\b(short|compact-short|tight|sm):(h|py|px|text|gap)-/,
      )
    cleanup()
    render(<AuthHeader eyebrow="E" title="Welcome Back." subtitle="S" />)
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('var(--auth-title')
  })

  // Regression (user report): on phones the page scrolled because the tagline sat under the card.
  it('shows only the card on phones: the tagline is hidden below md and on short landscape screens', () => {
    renderLogin()
    const tagline = screen.getByText(hero.tagline.title).closest('div.mt-14') as HTMLElement
    expect(tagline.className).toMatch(/(^|\s)hidden(\s|$)/)
    expect(tagline.className).toContain('md:flex')
    expect(tagline.className).toContain('[@media(max-height:40rem)]:hidden')
    // Phones centre the card vertically in the space under the bar.
    expect((screen.getByRole('main').lastElementChild as HTMLElement).className).toContain('justify-center')
  })

  // Regression (user report): guarantee no horizontal scrollbar from decorative layers.
  it('clips horizontal overflow on the shell without breaking sticky (clip, not hidden)', () => {
    renderLogin()
    const shell = screen.getByRole('main').parentElement as HTMLElement
    expect(shell.className).toContain('overflow-x-clip')
    expect(shell.className).not.toMatch(/overflow(-x)?-hidden/)
  })

  it('removes its resize listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderLogin()
    unmount()
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('removes its media-query listener on unmount', () => {
    const { unmount } = renderLogin()
    expect(listeners.size).toBeGreaterThan(0)
    unmount()
    expect(listeners.size).toBe(0)
  })
})

/** Regressions (user report: Register scrolled; mobile should show the card only, like Login). */
describe('AuthLayout (Register, compact)', () => {
  const renderRegister = () =>
    render(
      <MemoryRouter>
        <AuthLayout hero={{ ...hero, cardSide: 'right' }} variant="register" compact>
          <AuthHeader eyebrow="Join the SAF Studio" title="Create Your Account." subtitle="S" compact />
          <LoginForm />
        </AuthLayout>
      </MemoryRouter>,
    )

  it('shows the tagline only on tall image-free screens; phones and laptops get the card alone', () => {
    renderRegister()
    const tagline = screen.getByText(hero.tagline.title).closest('div.mt-14') as HTMLElement
    expect(tagline.className).toMatch(/(^|\s)hidden(\s|$)/)
    expect(tagline.className).toContain('[@media(min-width:48rem)_and_(min-height:68rem)]:flex')
    expect(tagline.className).not.toContain('md:flex')
  })

  it('keeps the card centred with fluid padding at every width (no fixed md top offset)', () => {
    renderRegister()
    const main = screen.getByRole('main')
    expect(main.hasAttribute('data-compact')).toBe(true)
    const zone = main.lastElementChild as HTMLElement
    expect(zone.className).toContain('justify-center')
    expect(zone.className).toContain('py-(--auth-zone-py)')
    expect(zone.className).not.toMatch(/md:pt-20|md:justify-start/)
  })

  it('drops only the decorative eyebrow on short screens (≤ 640px); title and fields stay', () => {
    renderRegister()
    const eyebrow = screen.getByText('Join the SAF Studio')
    expect(eyebrow.className).toContain('[@media(max-height:40rem)]:hidden')
    expect(screen.getByRole('heading', { level: 1, name: 'Create Your Account.' })).toBeTruthy()
  })

  it('Login keeps its own layout (tagline from md, md top offset, eyebrow only hidden ≤ 576px)', () => {
    render(
      <MemoryRouter>
        <AuthLayout hero={hero} variant="login">
          <AuthHeader eyebrow="Your creative space" title="Welcome Back." />
        </AuthLayout>
      </MemoryRouter>,
    )
    const zone = screen.getByRole('main').lastElementChild as HTMLElement
    expect(zone.className).toContain('md:pt-20')
    const tagline = screen.getByText(hero.tagline.title).closest('div.mt-14') as HTMLElement
    expect(tagline.className).toContain('md:flex')
    expect(screen.getByText('Your creative space').className).not.toContain('max-height:40rem')
  })
})
