import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { authApi } from '@/api/endpoints/auth'
import { useAuthStore, useUser } from '@/features/auth/stores/authStore'


export default function CompanySettingsPage() {
  const user = useUser()
  const setUser = useAuthStore((state) => state.setUser)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [reportPreparedBy, setReportPreparedBy] = useState('')
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFirstName(user?.first_name || '')
    setLastName(user?.last_name || '')
    setCompany(user?.profile?.company || '')
    setReportPreparedBy(user?.profile?.report_prepared_by || '')
  }, [user])

  const previewUrl = useMemo(() => {
    if (companyLogoFile) {
      return URL.createObjectURL(companyLogoFile)
    }
    if (removeLogo) {
      return null
    }
    return user?.profile?.company_logo_url || null
  }, [companyLogoFile, removeLogo, user?.profile?.company_logo_url])

  useEffect(() => {
    return () => {
      if (companyLogoFile && previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [companyLogoFile, previewUrl])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    try {
      setSaving(true)
      setMessage(null)
      setError(null)

      const formData = new FormData()
      formData.append('first_name', firstName)
      formData.append('last_name', lastName)
      formData.append('company', company)
      formData.append('report_prepared_by', reportPreparedBy)
      formData.append('remove_company_logo', removeLogo ? 'true' : 'false')

      if (companyLogoFile) {
        formData.append('company_logo', companyLogoFile)
      }

      const updatedUser = await authApi.updateProfile(formData)
      setUser(updatedUser)
      setCompanyLogoFile(null)
      setRemoveLogo(false)
      setMessage('Company branding updated successfully.')
    } catch (err: any) {
      setError(err?.normalized?.message || err?.message || 'Failed to update company branding.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-stone-500">Report Branding</p>
            <h1 className="mt-2 text-4xl font-semibold text-stone-900">Company identity for issued reports</h1>
            <p className="mt-3 max-w-2xl text-stone-600">
              Set the company name, logo, and prepared-by defaults used by the engineering report preview. This branding
              becomes the primary client-facing identity on the report while Grispen remains a restrained production footer.
            </p>
          </div>
          <Link to="/settings/password" className="text-sm font-medium text-stone-700 underline underline-offset-4">
            Password settings
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_320px]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-700">First name</span>
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-4 py-3 text-stone-900 outline-none focus:border-stone-500"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-700">Last name</span>
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-4 py-3 text-stone-900 outline-none focus:border-stone-500"
                />
              </label>
            </div>

            <div className="mt-6 space-y-2">
              <label className="text-sm font-medium text-stone-700">Company name</label>
              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                className="w-full rounded-lg border border-stone-300 px-4 py-3 text-stone-900 outline-none focus:border-stone-500"
                placeholder="Example Marine Engineering Ltd."
              />
            </div>

            <div className="mt-6 space-y-2">
              <label className="text-sm font-medium text-stone-700">Prepared by</label>
              <input
                value={reportPreparedBy}
                onChange={(event) => setReportPreparedBy(event.target.value)}
                className="w-full rounded-lg border border-stone-300 px-4 py-3 text-stone-900 outline-none focus:border-stone-500"
                placeholder="Lead engineer or issuing reviewer"
              />
            </div>

            <div className="mt-6 space-y-3">
              <label className="text-sm font-medium text-stone-700">Company logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  setCompanyLogoFile(file)
                  if (file) {
                    setRemoveLogo(false)
                  }
                }}
                className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-lg file:border-0 file:bg-stone-900 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white"
              />
              {(user?.profile?.company_logo_url || companyLogoFile) && (
                <label className="inline-flex items-center gap-2 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    checked={removeLogo}
                    onChange={(event) => setRemoveLogo(event.target.checked)}
                  />
                  Remove current logo
                </label>
              )}
            </div>

            {message && <p className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
            {error && <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <div className="mt-8 flex items-center justify-between border-t border-stone-200 pt-6">
              <p className="text-sm text-stone-500">These defaults feed the engineering report preview automatically.</p>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-stone-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save branding'}
              </button>
            </div>
          </form>

          <aside className="rounded-2xl border border-stone-200 bg-stone-950 p-8 text-stone-100 shadow-sm">
            <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Preview</p>
            <h2 className="mt-3 text-2xl font-semibold">Report identity block</h2>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              The report preview uses your company as the primary client-facing brand. Grispen stays in the footer as the
              production platform so the document remains professional without feeling white-labeled or overbranded.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
              {previewUrl ? (
                <img src={previewUrl} alt="Company logo preview" className="h-20 w-20 object-contain bg-white p-2" />
              ) : (
                <div className="grid h-20 w-20 place-items-center border border-white/15 text-xs uppercase tracking-[0.2em] text-stone-400">
                  Logo
                </div>
              )}
              <p className="mt-4 text-lg font-semibold">{company || 'Company name'}</p>
              <p className="mt-1 text-sm text-stone-400">{reportPreparedBy || user?.username || 'Prepared by'}</p>
              <div className="mt-5 border-t border-white/10 pt-4 text-xs uppercase tracking-[0.18em] text-stone-500">
                Produced with Grispen Rigging SaaS
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
