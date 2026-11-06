import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useId, useState } from 'react'
import { TextField, type TextFieldProps } from './TextField'

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'rightSlot'>

/** TextField with a lock icon and a show/hide toggle. */
export function PasswordField({ id, leftIcon = <LockKeyhole />, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <TextField
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...props}
      id={inputId}
      type={visible ? 'text' : 'password'}
      leftIcon={leftIcon}
      rightSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // A toggle button keeps a constant name; its state is conveyed by aria-pressed.
          aria-label="Show password"
          aria-pressed={visible}
          aria-controls={inputId}
          // Negative margin enlarges the tap target to 40px without shifting the icon.
          className="-mr-2 grid size-(--field-toggle) place-items-center rounded-full text-ink-500 transition-colors hover:bg-mist-100 hover:text-ink-900 [&>svg]:size-(--field-icon) [&>svg]:stroke-[1.75]"
        >
          {/* SAF mockup shows an open eye while hidden ("tap to show"). */}
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </button>
      }
    />
  )
}
