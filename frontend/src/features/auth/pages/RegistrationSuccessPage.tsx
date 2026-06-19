import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authApi } from '@/api/endpoints/auth'

export default function RegistrationSuccessPage() {
  const location = useLocation()
  const email = (location.state as { email?: string })?.email ?? ''
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleResend = async () => {
    if (!email) return
    setResendStatus('sending')
    try {
      await authApi.resendVerificationEmail(email)
      setResendStatus('sent')
    } catch {
      setResendStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Check your email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We sent a verification link to{' '}
            {email ? <span className="font-medium text-gray-900">{email}</span> : 'your email address'}.
            Click the link to activate your account.
          </p>
        </div>

        <div className="rounded-md bg-blue-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                Didn't receive the email? Check your spam folder or request a new one below.
              </p>
            </div>
          </div>
        </div>

        {email && (
          <div className="text-center">
            {resendStatus === 'sent' ? (
              <p className="text-sm text-green-600 font-medium">Verification email resent!</p>
            ) : resendStatus === 'error' ? (
              <p className="text-sm text-red-600">Failed to resend. Please try again.</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendStatus === 'sending'}
                className="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:text-blue-300"
              >
                {resendStatus === 'sending' ? 'Sending...' : 'Resend verification email'}
              </button>
            )}
          </div>
        )}

        <div className="text-center">
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-500">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
