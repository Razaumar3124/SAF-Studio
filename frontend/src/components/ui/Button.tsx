import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Spinner } from '@/components/feedback/Spinner'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'primary-gradient' | 'secondary' | 'ghost'
type ButtonSize = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2.5 rounded-field font-semibold whitespace-nowrap ' +
  'transition-[background-color,border-color,box-shadow,color] duration-150 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress aria-busy:opacity-90'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-button hover:bg-brand-700 active:bg-brand-800 ' +
    'disabled:hover:bg-brand-600',
  // Login/Register CTA in the SAF mockups: teal with a slightly lighter sheen on the left. The
  // lightest stop is brand-600, so the white label is ≥ 5:1 everywhere (brand-500 would be 3.9:1).
  'primary-gradient':
    'bg-brand-600 bg-linear-to-r from-brand-600 to-brand-700 text-white shadow-button ' +
    'hover:from-brand-700 hover:to-brand-800 active:from-brand-800 active:to-brand-900',
  secondary:
    'border border-line bg-surface text-ink-900 shadow-field hover:border-ink-300 hover:bg-mist-50 ' +
    'active:bg-mist-100',
  ghost: 'text-ink-700 hover:bg-mist-100 active:bg-mist-200',
}

const sizes: Record<ButtonSize, string> = {
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** Icon before the label. Replaced by a spinner while `loading`. */
  leftIcon?: ReactNode
  /** Icon after the label (SAF CTAs: "Sign In →"). Hidden while `loading`. */
  rightIcon?: ReactNode
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean
  /** Label while loading, e.g. "Signing in…". Defaults to the normal children. */
  loadingText?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  loading = false,
  loadingText,
  type = 'button',
  disabled,
  className,
  children,
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      // Stay focusable while loading (no `disabled`) so focus isn't lost mid-submit.
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? <Spinner className="size-5" /> : leftIcon}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && rightIcon}
    </button>
  )
}
