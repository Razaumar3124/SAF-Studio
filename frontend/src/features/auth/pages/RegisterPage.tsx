import { authAssets } from '@/assets/auth'
import { pageTitle } from '@/config/app'
import { ROUTES } from '@/config/routes'
import { AuthHeader } from '../components/AuthHeader'
import { AuthLayout } from '../components/AuthLayout'
import { AuthSwitchPrompt } from '../components/AuthSwitchPrompt'
import { RegisterForm } from '../components/RegisterForm'

/**
 * Register. Same structure and props as Moonlight's page; SAF copy and backdrop. The form is
 * Moonlight's RegisterForm unchanged, including Full Name (backend requires `full_name`;
 * PORTING_PARITY R1 overrules the mockup). The SAF mockup's header is left-aligned in navy, like Login.
 */
export default function RegisterPage() {
  return (
    <AuthLayout hero={authAssets.register.backdrop} variant="register" compact>
      <title>{pageTitle('Create account')}</title>
      <div className="flex flex-col gap-(--auth-stack-gap)">
        <AuthHeader
          eyebrow="Join the SAF Studio"
          title="Create Your Account."
          subtitle="Start creating beautifully framed memories with Sagar Arts & Frames."
          compact
        />
        <RegisterForm />
        <AuthSwitchPrompt prompt="Already have an account?" linkLabel="Sign in" to={ROUTES.login} />
      </div>
    </AuthLayout>
  )
}
