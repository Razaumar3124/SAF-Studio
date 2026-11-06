import type { ReactNode } from 'react'
import { TextLink } from '@/components/ui/TextLink'
import type { AppRoute } from '@/config/routes'

interface AuthSwitchPromptProps {
  prompt: ReactNode
  linkLabel: ReactNode
  to: AppRoute
}

/** "New to Sagar Arts & Frames? Create an account" / "Already have an account? Sign in". */
export function AuthSwitchPrompt({ prompt, linkLabel, to }: AuthSwitchPromptProps) {
  return (
    <p className="text-center text-[length:var(--auth-prompt,1rem)] text-ink-700">
      {prompt}{' '}
      <TextLink to={to} className="whitespace-nowrap">
        {linkLabel}
      </TextLink>
    </p>
  )
}
