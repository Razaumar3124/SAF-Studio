import { authAssets } from '@/assets/auth'
import { pageTitle } from '@/config/app'
import { ROUTES } from '@/config/routes'
import { AuthHeader } from '../components/AuthHeader'
import { AuthLayout } from '../components/AuthLayout'
import { AuthSwitchPrompt } from '../components/AuthSwitchPrompt'
import { LoginForm } from '../components/LoginForm'

export default function LoginPage() {
  return (
    <AuthLayout hero={authAssets.login.backdrop} variant="login">
      <title>{pageTitle('Sign in')}</title>
      <div className="flex flex-col gap-(--auth-stack-gap)">
        <AuthHeader
          eyebrow="Your creative space"
          title="Welcome Back."
          subtitle="Sign in to continue designing your perfect gallery wall."
        />
        <LoginForm />
        <AuthSwitchPrompt
          prompt="New to Sagar Arts & Frames?"
          linkLabel="Create an account"
          to={ROUTES.register}
        />
      </div>
    </AuthLayout>
  )
}
