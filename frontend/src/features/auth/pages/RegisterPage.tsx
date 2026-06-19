import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '@/api/endpoints/auth'
import { useState } from 'react'
import type { RegisterFormData } from '@/types'
import { normalizeApiError, ApiFormErrors } from '@/lib/normalizeApiError'

const registerSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  password_confirm: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.password_confirm, {
  message: 'Passwords do not match',
  path: ['password_confirm'],
})

export default function RegisterPage() {
  const navigate = useNavigate()
  const [generalErrors, setGeneralErrors] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<ApiFormErrors>({})

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setGeneralErrors([])
      setFieldErrors({})
      await authApi.register(data.email, data.password)
      navigate('/register/success', { state: { email: data.email } })
    } catch (err: any) {
      console.error('Registration error:', err)
      const parsed = normalizeApiError(err)
      setGeneralErrors(parsed.generalErrors)
      setFieldErrors(parsed.fieldErrors)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              sign in to existing account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {generalErrors.length > 0 && (
            <div className="rounded-md bg-red-50 p-4">
              {generalErrors.map((msg, idx) => (
                <p key={idx} className="text-sm text-red-800">{msg}</p>
              ))}
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
              {fieldErrors.email?.map((msg, idx) => (
                <p key={idx} className="mt-1 text-sm text-red-600">{msg}</p>
              ))}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="At least 6 characters"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
              {(fieldErrors.password || fieldErrors.password1)?.map((msg, idx) => (
                <p key={idx} className="mt-1 text-sm text-red-600">{msg}</p>
              ))}
            </div>

            <div>
              <label htmlFor="password_confirm" className="block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <input
                id="password_confirm"
                type="password"
                autoComplete="new-password"
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                {...register('password_confirm')}
              />
              {errors.password_confirm && (
                <p className="mt-1 text-sm text-red-600">{errors.password_confirm.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-gray-600">
          Note: Your email will be used as your username
        </p>
      </div>
    </div>
  )
}
