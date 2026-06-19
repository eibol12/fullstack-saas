import { ReactNode } from 'react'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmButtonClassName?: string
  isLoading?: boolean
}

/**
 * ConfirmationModal Component
 *
 * Reusable modal for user confirmations
 * Blocks interaction until user confirms or cancels
 *
 * Usage:
 * ```tsx
 * <ConfirmationModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onConfirm={handleConfirm}
 *   title="Confirm Action"
 *   message="Are you sure?"
 * />
 * ```
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmButtonClassName = 'bg-blue-600 hover:bg-blue-700 text-white',
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop itself, not its children
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

        {/* Message */}
        <div className="text-sm text-gray-600 mb-6">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonClassName}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
