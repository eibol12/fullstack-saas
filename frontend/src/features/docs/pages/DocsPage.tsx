import { useState, useEffect, useRef } from 'react'
import {
  BookOpen,
  FolderPlus,
  BarChart2,
  Layers,
  FileText,
  Building2,
  CreditCard,
  Mail,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react'

const SECTIONS = [
  { id: 'overview',  label: 'Overview',          icon: BookOpen },
  { id: 'projects',  label: 'Projects',           icon: FolderPlus },
  { id: 'analysis',  label: 'Analysis',           icon: BarChart2 },
  { id: 'design',    label: 'Design',             icon: Layers },
  { id: 'report',    label: 'Reports & Export',   icon: FileText },
  { id: 'settings',  label: 'Company Branding',   icon: Building2 },
  { id: 'billing',   label: 'Plans & Limits',     icon: CreditCard },
  { id: 'support',   label: 'Contact Support',    icon: Mail },
]

function Note({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info:    { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-800',   icon: <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" /> },
    warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800',  icon: <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" /> },
    success: { bg: 'bg-green-50 border-green-200', text: 'text-green-800',  icon: <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> },
  }
  const s = styles[type]
  return (
    <div className={`flex gap-2.5 rounded-lg border p-3.5 text-sm ${s.bg} ${s.text} mb-4`}>
      {s.icon}
      <span>{children}</span>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-5">
      <div className="shrink-0 flex items-start justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold mt-0.5">{n}</div>
      <div>
        <p className="font-semibold text-slate-800 mb-1">{title}</p>
        <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function SectionHeading({ id, title, icon: Icon }: { id: string; title: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div id={id} className="flex items-center gap-3 mb-5 scroll-mt-6">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100">
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
    </div>
  )
}

function FieldRow({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex gap-3 py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded shrink-0 self-start mt-0.5">{name}</span>
      <span className="text-slate-600">{desc}</span>
    </div>
  )
}

export default function DocsPage() {
  const [active, setActive] = useState('overview')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observerRef.current?.observe(el)
    })
    return () => observerRef.current?.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Documentation</h1>
          <p className="mt-2 text-slate-500">Learn how to use Grispen to run rigorous lifting analyses and produce professional engineering reports.</p>
        </div>

        <div className="flex gap-8 items-start">
          {/* Sidebar */}
          <aside className="hidden lg:block w-56 shrink-0 sticky top-6">
            <nav className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-0.5">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    active === id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 space-y-12 min-w-0">

            {/* ── OVERVIEW ── */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-7">
              <SectionHeading id="overview" title="Overview" icon={BookOpen} />
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Grispen is a cloud-based rigging engineering platform built around the <strong>DNV-ST-N001</strong> standard. It takes your lift geometry and load data as inputs and produces fully calculated sling loads, optimal component selections, and stamped engineering reports — without requiring CAD or specialist software.
              </p>

              <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">The 3-step workflow</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {[
                  { n: 1, title: 'Analysis', desc: 'Define the load scenario and lifting geometry. Grispen applies DNV factors and computes per-point sling loads.' },
                  { n: 2, title: 'Design',   desc: 'Set component preferences. The engine selects optimal shackles, masterlinks, and wire ropes for each sling leg.' },
                  { n: 3, title: 'Report',   desc: 'Pick a design combination and export a ready-to-issue PDF report with your company branding.' },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{n}</span>
                      <span className="font-semibold text-slate-800 text-sm">{title}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <Note type="info">
                Each project can hold multiple analyses (e.g. different load cases), and each analysis can hold multiple designs (e.g. minimum vs. conservative build). Only one combination is flagged for the final report at a time.
              </Note>
            </section>

            {/* ── PROJECTS ── */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-7">
              <SectionHeading id="projects" title="Projects" icon={FolderPlus} />
              <p className="text-slate-600 text-sm leading-relaxed mb-5">
                Projects are the top-level containers. Every analysis and design lives inside a project. Manage all your projects from the <strong>Dashboard</strong>.
              </p>

              <h3 className="font-semibold text-slate-800 mb-3">Creating a project</h3>
              <Step n={1} title='Open the Dashboard'>Navigate to <strong>Workspace</strong> in the sidebar. Your projects are listed here.</Step>
              <Step n={2} title='Click "New project"'>A modal will appear. Enter a project name and an optional description.</Step>
              <Step n={3} title='Enter the Workspace'>After creation you are taken directly to the project workspace, ready for your first analysis.</Step>

              <Note type="info">
                The Dashboard also shows headline stats — total projects, analyses, and designs — so you can track your usage against your plan limits at a glance.
              </Note>
            </section>

            {/* ── ANALYSIS ── */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-7">
              <SectionHeading id="analysis" title="Analysis" icon={BarChart2} />
              <p className="text-slate-600 text-sm leading-relaxed mb-5">
                An analysis captures the full geometry of a lift — weight, CoG, lifting point positions, and hook height — and uses the DNV-ST-N001 corner-reference model to compute load factors and per-point sling loads.
              </p>

              <h3 className="font-semibold text-slate-800 mb-3">Step 1 — Basic info</h3>
              <div className="mb-5 space-y-0 divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                <FieldRow name="Name" desc="A label to identify this load case within the project." />
                <FieldRow name="Max Gross Weight" desc="Dry weight of the load in kilograms (kg). DNV rigging weight factors are applied on top of this." />
                <FieldRow name="Location" desc="Offshore, Onshore, Inshore, or Subsea. Affects the DNV dynamic amplification factor (DAF)." />
                <FieldRow name="Lifting Points" desc="Number of sling legs: 1, 2, 3, or 4. Governs the geometry model and skew load factor." />
              </div>

              <h3 className="font-semibold text-slate-800 mb-3">Step 2 — Geometry</h3>
              <p className="text-sm text-slate-600 mb-3">All coordinates are relative to the load's Centre of Gravity (CoG).</p>
              <div className="mb-3 space-y-0 divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                <FieldRow name="Hook Height" desc="Vertical distance from the CoG to the crane hook (metres). Used to compute the sling angle L dimension." />
                <FieldRow name="CoG (x, y, z)" desc="Position of the centre of gravity in the load's local coordinate system." />
                <FieldRow name="Lifting Point coords" desc="x, y, z position of each lifting lug relative to CoG. Enter one set per sling leg." />
                <FieldRow name="Equal Heights" desc="Toggle to lock all lifting points to the CoG plane — use for level lifts where all lugs are at the same height." />
              </div>

              <Note type="info">
                Use the <strong>PDF Calibrator</strong> tool (accessible from the geometry step) to extract exact lug coordinates directly from a rigging drawing — no manual measurement needed.
              </Note>

              <p className="text-sm text-slate-600 mb-4">
                The <strong>live 3D visualizer</strong> updates as you type. Use it to verify the geometry looks correct before submitting.
              </p>

              <h3 className="font-semibold text-slate-800 mb-3">Step 3 — Review & submit</h3>
              <p className="text-sm text-slate-600 mb-5">
                A summary of all inputs is shown alongside the final 3D geometry. Confirm everything is correct, then submit to run the DNV calculation.
              </p>

              <h3 className="font-semibold text-slate-800 mb-3">Reading the results</h3>
              <div className="mb-3 space-y-0 divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                <FieldRow name="DNV Factors" desc="Weight factor, rigging weight factor, CoG uncertainty, yaw, skew load, and DAF — all computed per the standard." />
                <FieldRow name="Static Sling Loads" desc="Per-point loads in tonnes (Te) without dynamic amplification." />
                <FieldRow name="Dynamic Sling Loads" desc="Per-point loads in tonnes (Te) with DAF applied — these are the governing design loads." />
                <FieldRow name="Hook Load" desc="Total crane hook load (static and dynamic) shown separately." />
              </div>
              <Note type="success">
                The bulwark height slider on the 3D results model lets you visualise sling clearance over vessel structure at different flange heights.
              </Note>
            </section>

            {/* ── DESIGN ── */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-7">
              <SectionHeading id="design" title="Design" icon={Layers} />
              <p className="text-slate-600 text-sm leading-relaxed mb-5">
                A design takes the sling loads from an analysis and finds the optimal rigging components for each leg. You can optionally specify preferred component types, capacities, and manufacturers, or let the engine choose freely.
              </p>

              <h3 className="font-semibold text-slate-800 mb-3">Design form fields</h3>
              <div className="mb-5 space-y-0 divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                <FieldRow name="Name" desc="A label for this design build (e.g. 'Minimum build', 'Grade-S shackles')." />
                <FieldRow name="Set as active" desc="Marks this design as the default shown when the project workspace loads." />
                <FieldRow name="Preference rows" desc="Each row defines one layer of the rigging stack from hook to load. Add as many as needed." />
              </div>

              <h3 className="font-semibold text-slate-800 mb-3">Component types per row</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {[
                  { name: 'Shackle',               desc: 'Bow or dee shackles. Select by WLL and optionally narrow by manufacturer and model.' },
                  { name: 'Masterlink',             desc: 'Single masterlinks. Select by WLL, manufacturer, and model.' },
                  { name: 'Masterlink Assembly',   desc: 'Pre-assembled masterlink sets. Select by WLL, manufacturer, and model.' },
                  { name: 'Wire Rope',              desc: 'Sling wire rope. Select by MBL, then specify eye type, termination, and configuration.' },
                ].map(({ name, desc }) => (
                  <div key={name} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-800 mb-1">{name}</p>
                    <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <Note type="info">
                Manufacturer and model fields are linked — selecting a manufacturer filters the model dropdown. Selecting a model auto-fills the manufacturer if left blank.
              </Note>

              <h3 className="font-semibold text-slate-800 mb-3">Reading design results</h3>
              <p className="text-sm text-slate-600 mb-3">
                The engine returns one or more <strong>combinations</strong> — typically a minimum build and a conservative build. Each combination shows:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 mb-4 pl-1">
                <li>Component table with WLL / MBL and <strong>Utilization Ratio (UR)</strong> per item</li>
                <li>Compatibility badge — confirms all components are compatible with each other</li>
                <li>Warnings for any geometric or capacity edge cases</li>
                <li>Interactive 3D arrangement stack visualizer</li>
              </ul>
              <Note type="warning">
                A UR above 1.0 means the component is over-utilised for this load. The engine will flag this, but it is your responsibility as the engineer of record to verify acceptability.
              </Note>
              <p className="text-sm text-slate-600">
                Click <strong>"Select for report"</strong> on the combination you want to carry forward to the PDF.
              </p>
            </section>

            {/* ── REPORT ── */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-7">
              <SectionHeading id="report" title="Reports & Export" icon={FileText} />
              <p className="text-slate-600 text-sm leading-relaxed mb-5">
                Once you have selected a design combination for the report, you can generate a stamped PDF engineering report directly from the workspace.
              </p>

              <h3 className="font-semibold text-slate-800 mb-3">Generating a report</h3>
              <Step n={1} title="Select a combination">In the Design Results view, click <strong>"Select for report"</strong> on the combination you want to include.</Step>
              <Step n={2} title='Open the Report tab'>In the workspace progress rail, click <strong>Step 3 — Report</strong>. The report preview loads immediately.</Step>
              <Step n={3} title='Export to PDF'>Click the <strong>Export PDF</strong> button. The report downloads as a formatted PDF including your company logo, name, and branding from Settings.</Step>

              <Note type="info">
                PDF export is available on <strong>Starter</strong> and <strong>Pro</strong> plans. Free-tier users can view the on-screen report preview but cannot download a PDF.
              </Note>

              <h3 className="font-semibold text-slate-800 mt-5 mb-3">What the report contains</h3>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 pl-1">
                <li>Project and analysis summary (load case, location, gross weight)</li>
                <li>DNV factors and calculation methodology reference</li>
                <li>Geometry diagram and lifting point table</li>
                <li>Static and dynamic sling loads per leg</li>
                <li>Selected rigging arrangement with component specifications</li>
                <li>Utilization ratios and compatibility confirmation</li>
                <li>Company branding (logo, name, prepared-by)</li>
              </ul>
            </section>

            {/* ── SETTINGS ── */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-7">
              <SectionHeading id="settings" title="Company Branding" icon={Building2} />
              <p className="text-slate-600 text-sm leading-relaxed mb-5">
                Configure the identity that appears on every exported report. Access this page from <strong>Company</strong> in the sidebar.
              </p>

              <div className="mb-5 space-y-0 divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                <FieldRow name="First / Last Name" desc="Your name as it will appear in the 'Prepared by' field on reports." />
                <FieldRow name="Prepared By" desc="Free-text field for a role or reviewer name — e.g. 'Lead Rigging Engineer'." />
                <FieldRow name="Company Name" desc="Your organisation name shown prominently on the report header." />
                <FieldRow name="Company Logo" desc="Upload a PNG or JPG. The logo is placed in the report header next to the company name." />
              </div>

              <p className="text-sm text-slate-600">
                A live preview on the right side of the settings page shows exactly how your branding will appear on issued reports. Changes apply to all future exports.
              </p>
            </section>

            {/* ── BILLING ── */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-7">
              <SectionHeading id="billing" title="Plans & Limits" icon={CreditCard} />
              <p className="text-slate-600 text-sm leading-relaxed mb-5">
                Grispen offers three tiers. Your current usage is shown on the <strong>Billing</strong> page.
              </p>

              <div className="overflow-x-auto mb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border border-slate-200">
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-r border-slate-200">Feature</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-slate-700 border-r border-slate-200">Free</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-slate-700 border-r border-slate-200">Starter</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-blue-700">Pro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 border border-slate-200">
                    {[
                      ['Projects',                 'Limited',     'More',      'Unlimited'],
                      ['Analyses per project',     'Limited',     'More',      'Unlimited'],
                      ['Designs per analysis',     'Limited',     'More',      'Unlimited'],
                      ['PDF Export',               '—',           '✓',         '✓'],
                      ['API Access',               '—',           '—',         '✓'],
                      ['Support',                  'Community',   'Email',     'Priority'],
                    ].map(([feat, free, starter, pro]) => (
                      <tr key={feat} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-700 font-medium border-r border-slate-200">{feat}</td>
                        <td className="px-4 py-2.5 text-center text-slate-500 border-r border-slate-200">{free}</td>
                        <td className="px-4 py-2.5 text-center text-slate-600 border-r border-slate-200">{starter}</td>
                        <td className="px-4 py-2.5 text-center text-blue-700 font-medium">{pro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Note type="info">
                Exact limits for each tier are shown live on the <strong>Billing</strong> page under "Usage Summary". When you hit a limit, a banner will appear in the relevant section with a link to upgrade.
              </Note>

              <h3 className="font-semibold text-slate-800 mb-3">Upgrading or cancelling</h3>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 pl-1">
                <li>Go to <strong>Billing</strong> in the sidebar and click <strong>Upgrade Plan</strong> or <strong>View All Plans</strong>.</li>
                <li>Payment is handled securely by Stripe. Your card is never stored on Grispen servers.</li>
                <li>To update payment methods, click <strong>Manage Payment Methods</strong> — this opens the Stripe customer portal.</li>
                <li>Cancellations take effect at the end of the current billing period. You retain full access until then.</li>
              </ul>
            </section>

            {/* ── SUPPORT ── */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-7">
              <SectionHeading id="support" title="Contact Support" icon={Mail} />
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                If you have a question that isn't answered here, reach out directly.
              </p>

              <a
                href="mailto:abel.osumi@grispen.com"
                className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Mail className="h-4 w-4" />
                abel.osumi@grispen.com
                <ChevronRight className="h-4 w-4 opacity-70" />
              </a>

              <div className="mt-6 text-sm text-slate-500">
                <p>Response times by plan:</p>
                <ul className="mt-2 space-y-1 pl-1">
                  <li><strong className="text-slate-700">Free</strong> — community support (documentation only)</li>
                  <li><strong className="text-slate-700">Starter</strong> — email support, best effort</li>
                  <li><strong className="text-slate-700">Pro</strong> — priority email support</li>
                </ul>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  )
}
