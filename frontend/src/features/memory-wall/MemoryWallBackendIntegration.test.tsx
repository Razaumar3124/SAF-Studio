// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/feedback/Toaster'
import * as geometryApi from '@/services/geometryApi'
import MemoryWallPage from './pages/MemoryWallPage'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('48rem'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderPlanner() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <MemoryWallPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('MemoryWallPage - Backend Integration (Phase 3)', () => {
  it('calls geometryApi.generateLayout on "Generate Layout" click and applies result', async () => {
    const generateSpy = vi.spyOn(geometryApi, 'generateLayout').mockResolvedValue({
      layout_type: 'salon',
      variant: 1,
      seed: 9999,
      bounding_box: { min_x: 10, min_y: 10, max_x: 90, max_y: 70, width_inches: 80, height_inches: 60 },
      wall_coverage_percentage: 48.0,
      fits: true,
      engine_used: 'smart_llm',
      ai_rationale: 'Balanced eclectic salon wall centered at gallery eye-level',
      items: [],
    })

    renderPlanner()

    const generateBtn = screen.getByRole('button', { name: /Generate Layout/i })
    await act(async () => {
      fireEvent.click(generateBtn)
    })

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText(/Balanced eclectic salon wall centered at gallery eye-level/i)).toBeTruthy()
  })

  it('calls geometryApi.regenerateLayout on "Regenerate" and applies variation', async () => {
    const regenSpy = vi.spyOn(geometryApi, 'regenerateLayout').mockResolvedValue({
      layout_type: 'grid',
      variant: 2,
      seed: 8888,
      bounding_box: { min_x: 10, min_y: 10, max_x: 90, max_y: 70, width_inches: 80, height_inches: 60 },
      wall_coverage_percentage: 45.0,
      fits: true,
      engine_used: 'geometric',
      items: [],
    })

    renderPlanner()

    const regenBtn = screen.getByRole('button', { name: /Regenerate/i })
    await act(async () => {
      fireEvent.click(regenBtn)
    })

    await waitFor(() => {
      expect(regenSpy).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText(/Regenerated layout variation 3/i)).toBeTruthy()
  })

  it('calls geometryApi.redesignLayout on "Redesign" and applies new style', async () => {
    const redesignSpy = vi.spyOn(geometryApi, 'redesignLayout').mockResolvedValue({
      layout_type: 'salon',
      variant: 0,
      seed: 7777,
      bounding_box: { min_x: 10, min_y: 10, max_x: 90, max_y: 70, width_inches: 80, height_inches: 60 },
      wall_coverage_percentage: 42.0,
      fits: true,
      engine_used: 'smart_llm',
      ai_rationale: 'Transformed layout to modern salon arrangement',
      items: [],
    })

    renderPlanner()

    const redesignBtn = screen.getByRole('button', { name: /Redesign/i })
    await act(async () => {
      fireEvent.click(redesignBtn)
    })

    await waitFor(() => {
      expect(redesignSpy).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText(/Transformed layout to modern salon arrangement/i)).toBeTruthy()
  })

  it('falls back to local geometry calculation gracefully if backend geometry fails', async () => {
    vi.spyOn(geometryApi, 'generateLayout').mockRejectedValue(new Error('Network error'))

    renderPlanner()

    const generateBtn = screen.getByRole('button', { name: /Generate Layout/i })
    await act(async () => {
      fireEvent.click(generateBtn)
    })

    // Should not crash and should show fallback toast
    await waitFor(() => {
      expect(screen.getByText(/Best fit: .* layout, option/i)).toBeTruthy()
    })
  })
})
