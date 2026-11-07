import { ArrowRight } from 'lucide-react'
import type { FormEventHandler, ReactNode } from 'react'
import { Alert } from '@/components/feedback/Alert'
import { Button, type ButtonProps } from '@/components/ui/Button'
import { Divider } from '@/components/ui/Divider'
import { cn } from '@/lib/cn'
import { GoogleSignIn } from './GoogleSignIn'

interface AuthFormProps {
  /** Accessible name of the form landmark, e.g. "Sign in". */
  label: string
  onSubmit: FormEventHandler<HTMLFormElement>
  formError: string | null
  submitting: boolean
  submitLabel: string
  /** Button text while submitting, e.g. "Signing in…". */
  submittingLabel: string
  /** Both SAF CTAs share the teal sheen, so `primary-gradient` is the SAF default. */
  submitVariant?: Extract<ButtonProps['variant'], 'primary' | 'primary-gradient'>
  /**
   * Longer form (Register). Kept for API parity with Moonlight; SAF density now comes from the
   * fluid tokens, which AuthLayout's `data-compact` already tightens for Register.
   */
  compact?: boolean
  /** Google SSO action context ('register' activates GIS flow; 'login' shows placeholder). */
  googleAction?: 'register' | 'login'
  /** The fields. */
  children: ReactNode
}

/**
 * Shared skeleton of the auth forms (mockups): form-level error → fields → primary CTA →
 * "OR" → Continue with Google. Login and Register only provide their fields and labels.
 */
export function AuthForm({
  label,
  onSubmit,
  formError,
  submitting,
  submitLabel,
  submittingLabel,
  submitVariant = 'primary-gradient',
  googleAction = 'login',
  children,
}: AuthFormProps) {
  return (
    <div
      className={cn(
        'flex flex-col',
        'gap-(--auth-section-gap)',
        // Google button (GoogleSignIn is ≡ Moonlight, so it's sized from here).
        '[&>div:last-child_button]:h-(--auth-alt-h) [&>div:last-child_button]:text-[length:var(--auth-alt-text)]',
        '[&>div:last-child_img]:size-(--auth-btn-icon)',
      )}
    >
      <form
        noValidate
        onSubmit={onSubmit}
        aria-label={label}
        className={cn('flex flex-col', 'gap-(--auth-form-gap)')}
      >
        {formError && <Alert tone="error">{formError}</Alert>}
        {children}
        <Button
          type="submit"
          variant={submitVariant}
          size="lg"
          fullWidth
          loading={submitting}
          loadingText={submittingLabel}
          rightIcon={<ArrowRight aria-hidden className="size-(--auth-btn-icon)" />}
          className="mt-1 h-(--auth-cta-h) text-(length:--auth-cta-text)"
        >
          {submitLabel}
        </Button>
      </form>

      <Divider label="Or" />

      <GoogleSignIn action={googleAction} />
    </div>
  )
}
