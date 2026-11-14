// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OtpInput } from './OtpInput'

afterEach(() => {
  cleanup()
})

describe('OtpInput', () => {
  it('renders 6 input boxes with accessible labels', () => {
    render(<OtpInput value="" onChange={vi.fn<(...args: unknown[]) => unknown>()} />)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(inputs).toHaveLength(6)
    expect(inputs[0]?.getAttribute('aria-label')).toBe('Digit 1 of 6')
    expect(inputs[5]?.getAttribute('aria-label')).toBe('Digit 6 of 6')
  })

  it('displays the provided digits across the boxes', () => {
    render(<OtpInput value="582" onChange={vi.fn<(...args: unknown[]) => unknown>()} />)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(inputs[0]?.value).toBe('5')
    expect(inputs[1]?.value).toBe('8')
    expect(inputs[2]?.value).toBe('2')
    expect(inputs[3]?.value).toBe('')
  })

  it('calls onChange with new digit when user types', () => {
    const onChange = vi.fn<(...args: unknown[]) => unknown>()
    render(<OtpInput value="" onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    const firstInput = inputs[0]
    expect(firstInput).toBeDefined()
    if (firstInput) {
      fireEvent.change(firstInput, { target: { value: '9' } })
    }
    expect(onChange).toHaveBeenCalledWith('9')
  })

  it('handles paste of full 6-digit code and calls onComplete', () => {
    const onChange = vi.fn<(...args: unknown[]) => unknown>()
    const onComplete = vi.fn<(...args: unknown[]) => unknown>()
    render(<OtpInput value="" onChange={onChange} onComplete={onComplete} />)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    const firstInput = inputs[0]
    expect(firstInput).toBeDefined()
    if (firstInput) {
      fireEvent.paste(firstInput, {
        clipboardData: {
          getData: () => '482910',
        },
      })
    }

    expect(onChange).toHaveBeenCalledWith('482910')
    expect(onComplete).toHaveBeenCalledWith('482910')
  })
})
