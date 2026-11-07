// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryWallAssets } from '@/assets/memoryWall'
import { ToastProvider } from '@/components/feedback/Toaster'
import { tokenStorage } from '@/services/tokenStorage'
import * as quotesApi from '@/services/quotesApi'
import { PLANNER_RULES, ROOM_PHOTO_IN } from '../constants'
import MemoryWallPage from './MemoryWallPage'

/**
 * SAF integration tests: the ported page stays fully dynamic through the SAF UI. The geometry and
 * reducer are Moonlight's (their own tests run unchanged); these prove the re-skinned controls are
 * still wired to them, including edge cases: zero/negative/garbage input, bounds, extreme aspects.
 */
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('48rem'), // tablet-up: panels expanded (not collapsible)
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => cleanup())

function renderPlanner() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <MemoryWallPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

const wallSvg = () => screen.getByRole('group', { name: /frames in a .* layout/ })
const frames = () => [...wallSvg().querySelectorAll<SVGGElement>('g[role="button"]')]
const positions = () => frames().map((g) => `${g.dataset.tx},${g.dataset.ty}`)
const viewBox = () => wallSvg().getAttribute('viewBox')

function commitDimension(label: string, value: string) {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
  return input as HTMLInputElement
}

describe('MemoryWallPage (SAF) — dynamic recalculation', () => {
  it('renders Moonlight defaults: 12 × 9 ft wall, 9 frames, grid', () => {
    renderPlanner()
    expect(viewBox()).toBe('0 0 144 108')
    expect(frames()).toHaveLength(9)
    expect((screen.getByRole('radio', { name: 'Grid' }) as HTMLInputElement).checked).toBe(true)
  })

  it('recalculates the whole layout when the wall size changes', () => {
    renderPlanner()
    const before = positions()
    commitDimension('Wall Width', '20')
    expect(viewBox()).toBe('0 0 240 108')
    expect(positions()).not.toEqual(before)
  })

  it.each([
    ['zero', '0'],
    ['negative', '-5'],
    ['not a number', 'abc'],
  ])('rejects a %s wall size, keeps the last valid layout and explains', (_, value) => {
    renderPlanner()
    const before = positions()
    const input = commitDimension('Wall Width', value)
    expect(viewBox()).toBe('0 0 144 108')
    expect(positions()).toEqual(before)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText(/Enter a number between/)).toBeTruthy()
  })

  it('clamps extreme sizes to the planner rules (and says so)', () => {
    renderPlanner()
    commitDimension('Wall Width', '1000')
    expect(viewBox()).toBe(`0 0 ${PLANNER_RULES.wallWidthIn.max} 108`)
    expect(screen.getByText(/Use 3–40 ft\./)).toBeTruthy()
    commitDimension('Wall Height', '0.1')
    expect(viewBox()).toBe(`0 0 ${PLANNER_RULES.wallWidthIn.max} ${PLANNER_RULES.wallHeightIn.min}`)
  })

  it('handles an extreme aspect ratio (40 ft × 4 ft) without losing frames', () => {
    renderPlanner()
    commitDimension('Wall Width', '40')
    commitDimension('Wall Height', '4')
    expect(viewBox()).toBe('0 0 480 48')
    expect(frames()).toHaveLength(9)
    for (const g of frames()) {
      expect(Number.isFinite(Number(g.dataset.tx))).toBe(true)
      expect(Number.isFinite(Number(g.dataset.ty))).toBe(true)
    }
    expect(screen.getByText(/Check fit/)).toBeTruthy() // too tall for a 4 ft wall: warned, not broken
  })

  it('Number of Frames (kept from Moonlight, D2) recalculates and is bounded 1–16', () => {
    renderPlanner()
    const inc = screen.getByRole('button', { name: 'Increase Number of Frames' })
    for (let i = 0; i < 20; i++) fireEvent.click(inc)
    expect(frames()).toHaveLength(PLANNER_RULES.frameCount.max)
    const dec = screen.getByRole('button', { name: 'Decrease Number of Frames' })
    for (let i = 0; i < 30; i++) fireEvent.click(dec)
    expect(frames()).toHaveLength(PLANNER_RULES.frameCount.min)
  })

  it.each(['Salon', 'Centre', 'Row'])('switching to %s re-arranges the frames', (style) => {
    renderPlanner()
    const before = positions()
    fireEvent.click(screen.getByRole('radio', { name: style }))
    expect((screen.getByRole('radio', { name: style }) as HTMLInputElement).checked).toBe(true)
    expect(positions()).not.toEqual(before)
  })

  it('changing a frame size (rapid successive changes) always reflects the latest input', () => {
    renderPlanner()
    const select = screen.getByLabelText('Frame Size')
    for (const id of ['5x7', '24x36', '8x10', '20x30']) fireEvent.change(select, { target: { value: id } })
    expect((select as HTMLSelectElement).value).toBe('20x30')
    expect(frames()[0]?.getAttribute('aria-label')).toContain('20 × 30 in')
  })

  it('"Apply to all frames" is a one-shot action (D3), not a persistent checkbox', () => {
    renderPlanner()
    fireEvent.change(screen.getByLabelText('Frame Size'), { target: { value: '5x7' } })
    const apply = screen.getByRole('button', { name: 'Apply to all frames' })
    expect(apply.hasAttribute('aria-pressed')).toBe(false)
    expect(screen.queryByRole('checkbox', { name: /apply to all/i })).toBeNull()
    fireEvent.click(apply)
    for (const g of frames()) expect(g.getAttribute('aria-label')).toContain('5 × 7 in')
    // Later edits affect only the selected frame again.
    fireEvent.change(screen.getByLabelText('Frame Size'), { target: { value: '8x10' } })
    expect(frames()[1]?.getAttribute('aria-label')).toContain('5 × 7 in')
  })

  it('keeps Moonlight colour lists (R2): 7 paint shades, 8 finishes, 4 mount colours; no colour wheel', () => {
    renderPlanner()
    const group = (name: string) => screen.getByRole('group', { name })
    expect(within(group('Paint Shade')).getAllByRole('radio')).toHaveLength(7)
    expect(within(group('Wood Moulding & Finish')).getAllByRole('radio')).toHaveLength(8)
    expect(within(group('Mount Colour')).getAllByRole('radio')).toHaveLength(4)
    expect(screen.queryByText(/custom colour|colour wheel/i)).toBeNull()
  })

  it('has no price display and no mat-unit dropdown (future features, not in Moonlight)', () => {
    renderPlanner()
    expect(screen.queryByText(/Estimated Price|₹/)).toBeNull()
    expect(screen.queryByRole('combobox', { name: /mat/i })).toBeNull()
  })
})

/** Regressions from the Phase 4 audit (wide-window white space, forked CTA). */
describe('Planner layout (audit regressions)', () => {
  it('is fluid: no centred max-width on the page or the brand bar (no blank side margins)', () => {
    renderPlanner()
    expect(screen.getByRole('main').className).not.toMatch(/max-w-/)
    // The brand bar (jsdom maps every <header> to `banner`; Chromium exposes exactly one: verified in the audit).
    const bar = document.querySelector('header.sticky') as HTMLElement
    expect(bar).toBeTruthy()
    for (const el of [bar, ...bar.querySelectorAll('*')])
      expect(el.getAttribute('class') ?? '').not.toMatch(/max-w-\[100rem\]/)
  })

  it('sets the canvas on a room stage tinted by the paint colour, reusing the SVG room image (no extra download)', () => {
    renderPlanner()
    const svg = wallSvg()
    const stage = svg
      .closest('section')
      ?.querySelector<HTMLElement>('[aria-hidden="true"][style*="background-color"]')
    expect(stage).toBeTruthy()
    const svgRoomHref = svg.querySelector('image')?.getAttribute('href')
    expect(stage?.querySelector('img')?.getAttribute('src')).toBe(svgRoomHref)
    const before = stage?.style.backgroundColor
    fireEvent.click(screen.getByRole('radio', { name: 'Charcoal' }))
    expect(stage?.style.backgroundColor).not.toBe(before)
  })

  it('"Request a Quote" prompts unauthenticated users to sign in', () => {
    tokenStorage.clear()
    renderPlanner()
    const quotes = screen.getAllByRole('button', { name: /Request a Quote/ })
    expect(quotes).toHaveLength(2)
    for (const q of quotes) expect(q.className).toContain('rounded-field') // shared Button base
    fireEvent.click(quotes[0] as HTMLElement)
    expect(screen.getByText(/Please sign in to request a quote/)).toBeTruthy()
  })

  it('"Request a Quote" captures design, prepares quote, and opens WhatsApp when authenticated', async () => {
    tokenStorage.save({
      access_token: 'fake-jwt-token',
      refresh_token: 'fake-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
    })

    const mockWindow = {
      closed: false,
      location: { href: '' },
      close: vi.fn(),
    }
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(mockWindow as unknown as Window)

    const prepareSpy = vi.spyOn(quotesApi, 'prepareQuote').mockResolvedValue({
      quote_id: 'SQ-2026-0099',
      status: 'draft',
      whatsapp_url: 'https://wa.me/919876543210?text=Hello%20SAF%20Studio',
      report_url: 'http://localhost:5173/q/test-token-123',
      expires_at: '2026-12-07T10:00:00Z',
    })

    renderPlanner()
    const quotes = screen.getAllByRole('button', { name: /Request a Quote/ })
    await act(async () => {
      fireEvent.click(quotes[0] as HTMLElement)
    })

    await waitFor(() => {
      expect(prepareSpy).toHaveBeenCalledTimes(1)
    })

    expect(mockWindow.location.href).toBe('https://wa.me/919876543210?text=Hello%20SAF%20Studio')
    expect(screen.getByText('SQ-2026-0099')).toBeTruthy()
    expect(screen.getByText(/Quote Request Prepared/)).toBeTruthy()

    openSpy.mockRestore()
    prepareSpy.mockRestore()
    tokenStorage.clear()
  })
})

describe('Reference sofa (SAF vector, Moonlight geometry)', () => {
  it('is drawn with its top exactly on the geometry sofa line, and removed when toggled off', () => {
    renderPlanner()
    const sofa = () => wallSvg().querySelector('[data-sofa]')
    expect(sofa()).not.toBeNull()
    const back = sofa()?.querySelectorAll('rect')[2] // legs ×2, then the back
    expect(Number(back?.getAttribute('y'))).toBeCloseTo(108 - ROOM_PHOTO_IN.sofaTopFromFloor, 5)

    act(() => {
      fireEvent.click(screen.getByRole('switch', { name: /84" Reference Scale Sofa/ }))
    })
    expect(sofa()).toBeNull()
  })

  it('always paints the SAF room photo under the frames (Paint Shade still tints the wall)', () => {
    renderPlanner()
    const room = wallSvg().querySelector('image')
    expect(room?.getAttribute('href')).toBe(memoryWallAssets.roomBackground.src)
    const paint = wallSvg().querySelector('rect')
    const before = paint?.getAttribute('fill')
    fireEvent.click(screen.getByRole('radio', { name: 'Charcoal' }))
    expect(wallSvg().querySelector('rect')?.getAttribute('fill')).not.toBe(before)
  })
})
