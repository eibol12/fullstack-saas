import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiUrl() {
  return import.meta.env.VITE_API_URL || 'http://localhost:8000'
}

export function getStripeKey() {
  return import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
}