import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes'
import { useForm } from '@/hooks/useForm'
import { register } from '@/services/authApi'
import { tokenStorage } from '@/services/tokenStorage'
import {
  mapRegisterError,
  REGISTER_FIELDS,
  REGISTER_INITIAL_VALUES,
  toRegisterRequest,
  validateRegisterField,
} from '../lib/registerValidation'

/** Register form: generic form behaviour from `useForm` + register rules, payload and errors. */
export function useRegisterForm() {
  const navigate = useNavigate()

  return useForm({
    fields: REGISTER_FIELDS,
    initialValues: REGISTER_INITIAL_VALUES,
    validateField: (field, value) => validateRegisterField(field, value),
    mapSubmitError: mapRegisterError,
    onSubmit: async (values, signal) => {
      const response = await register(toRegisterRequest(values), signal)
      if (response?.tokens) {
        tokenStorage.save(response.tokens)
      }
      navigate(ROUTES.memoryWall, { replace: true })
    },
  })
}
