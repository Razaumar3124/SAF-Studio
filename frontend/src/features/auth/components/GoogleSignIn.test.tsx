// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleSignIn } from './GoogleSignIn'

vi.mock('@/config/env', () => ({
  env: {
    apiBaseUrl: '/api/v1',
    googleClientId: 'test-google-client-id',
    isDev: false,
  },
}))

type ResizeCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void

describe('GoogleSignIn responsive sizing', () => {
  let currentWidth = 290
  let resizeCallback: ResizeCallback | undefined
  let disconnectSpy: ReturnType<typeof vi.fn<() => void>>
  let renderButtonSpy: ReturnType<typeof vi.fn<(parent: HTMLElement, options: unknown) => void>>
  let initializeSpy: ReturnType<typeof vi.fn<(config: unknown) => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    currentWidth = 290
    resizeCallback = undefined
    disconnectSpy = vi.fn<() => void>()

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          width: currentWidth,
          height: 44,
          top: 0,
          left: 0,
          bottom: 44,
          right: currentWidth,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    )

    class MockResizeObserver {
      constructor(cb: ResizeCallback) {
        resizeCallback = cb
      }
      observe() {}
      unobserve() {}
      disconnect() {
        disconnectSpy()
      }
    }

    vi.stubGlobal('ResizeObserver', MockResizeObserver)

    initializeSpy = vi.fn<(config: unknown) => void>()
    renderButtonSpy = vi.fn<(parent: HTMLElement, options: unknown) => void>((parent: HTMLElement) => {
      const child = document.createElement('div')
      parent.appendChild(child)
    })

    window.google = {
      accounts: {
        id: {
          initialize: initializeSpy,
          renderButton: renderButtonSpy,
          prompt: vi.fn<() => void>(),
          cancel: vi.fn<() => void>(),
        },
      },
    }
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (window as { google?: unknown }).google
  })

  function renderComponent(action: 'login' | 'register' = 'login') {
    return render(
      <MemoryRouter>
        <GoogleSignIn action={action} />
      </MemoryRouter>,
    )
  }

  it('sizes the GIS button to fit the measured card content width instead of overflowing', () => {
    currentWidth = 294.7
    renderComponent('register')

    expect(initializeSpy).toHaveBeenCalledTimes(1)
    expect(renderButtonSpy).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        width: 294,
        logo_alignment: 'center',
      }),
    )
  })

  it('clamps GIS button width to 400px maximum on wide containers', () => {
    currentWidth = 460
    renderComponent('login')

    expect(renderButtonSpy).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ width: 400 }),
    )
  })

  it('clamps GIS button width to 200px minimum on narrow positive containers', () => {
    currentWidth = 180
    renderComponent('login')

    expect(renderButtonSpy).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ width: 200 }),
    )
  })

  it('re-renders the GIS button when the container resizes, and skips redundant renders', () => {
    currentWidth = 290
    renderComponent('login')
    expect(renderButtonSpy).toHaveBeenCalledTimes(1)
    expect(renderButtonSpy).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ width: 290 }),
    )

    // Same floored width: should not re-render
    currentWidth = 290.9
    act(() => {
      resizeCallback?.([], {} as ResizeObserver)
      vi.advanceTimersByTime(150)
    })
    expect(renderButtonSpy).toHaveBeenCalledTimes(1)

    // Different width: should re-render once without re-initializing GIS
    currentWidth = 356
    act(() => {
      resizeCallback?.([], {} as ResizeObserver)
      vi.advanceTimersByTime(150)
    })
    expect(initializeSpy).toHaveBeenCalledTimes(1)
    expect(renderButtonSpy).toHaveBeenCalledTimes(2)
    expect(renderButtonSpy).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ width: 356 }),
    )
  })

  it('disconnects ResizeObserver on unmount', () => {
    const { unmount } = renderComponent('login')
    unmount()
    expect(disconnectSpy).toHaveBeenCalledTimes(1)
  })
})
