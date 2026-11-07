import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { ROUTES } from '@/config/routes'
import { useForm } from '@/hooks/useForm'
import {
  LOGIN_FIELDS,
  LOGIN_INITIAL_VALUES,
  mapLoginError,
  toLoginRequest,
  validateLoginField,
} from '../lib/loginValidation'

/** Login form: generic form behaviour from `useForm` + login rules, payload and error mapping. */
export function useLoginForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  return useForm({
    fields: LOGIN_FIELDS,
    initialValues: LOGIN_INITIAL_VALUES,
    validateField: (field, value) => validateLoginField(field, value),
    mapSubmitError: mapLoginError,
    onSubmit: async (values, signal) => {
      await login(toLoginRequest(values), signal)
      const from = (location.state as { from?: string } | null)?.from
      const target =
        from && typeof from === 'string' && from.startsWith('/') && !from.startsWith('/login')
          ? from
          : ROUTES.memoryWall
      navigate(target, { replace: true })
    },
  })
}
