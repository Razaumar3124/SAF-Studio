import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/cn'

/** In-app link in brand teal, underlined ("Create an account", "Forgot Password?"). */
export function TextLink({ className, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        'rounded-sm font-semibold text-brand-700 underline decoration-brand-700/50 underline-offset-3',
        'transition-colors hover:text-brand-800 hover:decoration-brand-800',
        className,
      )}
      {...props}
    />
  )
}
