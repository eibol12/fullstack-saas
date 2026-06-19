import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/endpoints/auth'
import { ChangePasswordFormData } from '@/types'
import { parseApiError } from '@/lib/errors'

const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  new_password_confirm: z.string(),
}).refine((data) => data.new_password === data.new_password_confirm, {
  message: "Passwords don't match",
  path: ['new_password_confirm'],
})

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      setErrorMessage('')
      await authApi.changePassword(
        data.old_password,
        data.new_password,
        data.new_password_confirm
      )
      setIsSuccess(true)
      reset()
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/dashboard')
      }, 3000)
    } catch (error) {
      setErrorMessage(parseApiError(error))
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Password changed successfully
            </h2>
          </div>
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-700">
              Your password has been changed. Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Change password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your current password and choose a new one
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {errorMessage && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="old_password" className="block text-sm font-medium text-gray-700">
                Current Password
              </label>
              <input
                {...register('old_password')}
                id="old_password"
                type="password"
                autoComplete="current-password"
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Current password"
              />
              {errors.old_password && (
                <p className="mt-1 text-sm text-red-600">{errors.old_password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="new_password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                {...register('new_password')}
                id="new_password"
                type="password"
                autoComplete="new-password"
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="New password"
              />
              {errors.new_password && (
                <p className="mt-1 text-sm text-red-600">{errors.new_password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="new_password_confirm" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <input
                {...register('new_password_confirm')}
                id="new_password_confirm"
                type="password"
                autoComplete="new-password"
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Confirm new password"
              />
              {errors.new_password_confirm && (
                <p className="mt-1 text-sm text-red-600">{errors.new_password_confirm.message}</p>
              )}
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Changing...' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
