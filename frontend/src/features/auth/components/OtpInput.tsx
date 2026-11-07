import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ChangeEvent,
  useRef,
} from 'react'
import { cn } from '@/lib/cn'

export interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  hasError?: boolean
  id?: string
  className?: string
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  id = 'otp-input',
  className,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')

  const focusInput = (index: number) => {
    const el = inputsRef.current[index]
    if (el) {
      el.focus()
      el.select()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.replace(/\D/g, '')
    if (!val) {
      // Clear this digit
      const nextDigits = [...digits]
      nextDigits[index] = ''
      const nextVal = nextDigits.join('').slice(0, 6)
      onChange(nextVal)
      return
    }

    const char = val.slice(-1)
    const nextDigits = [...digits]
    nextDigits[index] = char
    const nextVal = nextDigits.join('').slice(0, 6)
    onChange(nextVal)

    if (nextVal.length === 6) {
      onComplete?.(nextVal)
    }

    if (index < 5 && char) {
      focusInput(index + 1)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move to previous and clear it
        const nextDigits = [...digits]
        nextDigits[index - 1] = ''
        onChange(nextDigits.join(''))
        focusInput(index - 1)
        e.preventDefault()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1)
      e.preventDefault()
    } else if (e.key === 'ArrowRight' && index < 5) {
      focusInput(index + 1)
      e.preventDefault()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return

    onChange(pasted)
    if (pasted.length === 6) {
      onComplete?.(pasted)
      inputsRef.current[5]?.focus()
    } else {
      focusInput(Math.min(pasted.length, 5))
    }
  }

  return (
    <div
      role="group"
      aria-label="6-digit verification code"
      className={cn('flex items-center justify-between gap-2 sm:gap-3', className)}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el
          }}
          id={i === 0 ? id : `${id}-${i}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} of 6`}
          disabled={disabled}
          value={digits[i]}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          className={cn(
            'size-11 sm:size-12 rounded-lg border text-center font-mono text-xl font-bold transition-all',
            'focus:outline-none focus:ring-2',
            hasError
              ? 'border-crimson-400 text-crimson-600 focus:border-crimson-500 focus:ring-crimson-500/20'
              : 'border-mist-300 bg-white text-ink-900 focus:border-terracotta-500 focus:ring-terracotta-500/20',
            disabled && 'cursor-not-allowed bg-mist-100 text-ink-400'
          )}
        />
      ))}
    </div>
  )
}
